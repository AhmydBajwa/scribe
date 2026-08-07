const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { initiateSAMLLogin, handleSAMLACS, getSAMLMetadata, requireAuth } = require('./src/auth/saml');
const idpRouter = require('./src/auth/idp');
const { getDashboardAppointments, listDepartments, listProviders, syncAthenaPatientCaseForAppointment, getAthenaPatientById, getAthenaProviderById, getAthenaDepartmentById, createAthenaPatientCase, searchAthenaPatients, createAthenaPatient, getCachedAppointmentById, getMockAppointments, appendAthenaPatientCaseActionNote } = require('./src/appointments/athena');
const { CASE_STATUSES, ATHENA_LIFECYCLE_STATUSES, ALLOWED_TRANSITIONS, createCase, listCases, getCase, listCaseActivity, listAdminInbox, appendCaseNote, recordCaseAction, updateCaseStatus, updateAthenaLifecycleStatus, updateClinicalData, attachCaseAudio, getLatestCaseAudio, discardLatestCaseAudio, getTranscript, queueTranscriptForRecording, markTranscriptTranscribing, storeRawTranscript, cleanCaseTranscript, editCleanedTranscript, approveTranscript, failTranscript, getCasePromptInput, applyAthenaPatientCaseLink, applyAthenaPatientLink, logActivity, isTestMode } = require('./src/cases/cases');
const { upsertPatientReference, resetPatientRefsForTests } = require('./src/patients/patientRefs');
const { defaultPracticeId, isPracticeAdmin, listMembers, setMemberRole } = require('./src/auth/practiceRoles');
const { getFeedHealth, drainChangeFeed, consumeEvents } = require('./src/cases/feed');
const audioStorage = require('./src/cases/audioStorage');
const { transcribeAudio } = require('./src/transcripts/transcription');

const app = express();
const port = process.env.PORT || 3000;

// A Scribel case is only fully connected once it has an Athena patient case.
// Prefer an existing Athena case for an appointment, then create one when the
// appointment has not produced a patient case yet.
async function ensureAthenaPatientCaseLink(caseRecord) {
  const existing = await syncAthenaPatientCaseForAppointment(caseRecord);
  if (existing.athenaPatientCase) return existing;

  if (!caseRecord?.patientId || !caseRecord?.departmentId || !caseRecord?.providerId) {
    return { status: 'missing-context', athenaPatientCase: null };
  }

  const subject = caseRecord.reason || `Scribel case for ${caseRecord.patientName || 'patient'}`;
  const description = [
    caseRecord.visitType ? `Visit type: ${caseRecord.visitType}` : null,
    caseRecord.appointmentDate ? `Appointment date: ${caseRecord.appointmentDate}` : null,
    caseRecord.appointmentId ? `Appointment ID: ${caseRecord.appointmentId}` : null,
  ].filter(Boolean).join('\n');

  try {
    const athenaPatientCase = await createAthenaPatientCase({
      patientId: caseRecord.patientId,
      departmentId: caseRecord.departmentId,
      providerId: caseRecord.providerId,
      subject,
      description: description || undefined,
      appointmentId: caseRecord.appointmentId || undefined,
    });
    return athenaPatientCase
      ? { status: 'linked', athenaPatientCase }
      : { status: 'creation-failed', athenaPatientCase: null };
  } catch (error) {
    console.error(`Unable to create Athena patient case for Scribel case ${caseRecord.id}:`, error.message);
    return { status: 'creation-failed', athenaPatientCase: null };
  }
}

// When running tests (`node --test`) ensure each test-started server begins
// with a fresh case store to avoid cross-test pollution.
if (isTestMode) {
  const { resetCasesForTests } = require('./src/cases/cases');
  const originalListen = app.listen.bind(app);
  app.listen = function (...args) {
    try {
      resetCasesForTests();
      resetPatientRefsForTests();
    } catch (err) {
      // Non-fatal
    }
    return originalListen(...args);
  };
}

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'athena-sso-demo' });
});

// SP side: SP-initiated redirect to the IdP, then the IdP POSTs back here.
app.get('/auth/saml/login', initiateSAMLLogin);
app.post('/auth/saml/acs', handleSAMLACS);
app.get('/auth/saml/metadata', getSAMLMetadata);
app.post('/auth/logout', (req, res) => {
  res.clearCookie('sessionId');
  res.json({ ok: true, message: 'Signed out successfully.' });
});

// IdP side: local Identity Provider (login page + signed SAMLResponse issuance).
app.use(idpRouter);

function requireAdmin(req, res, next) {
  if (!req.user || !isPracticeAdmin(req.user, req.user.practiceId || defaultPracticeId())) {
    return res.status(403).json({ ok: false, message: 'Admin access required.' });
  }
  next();
}

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

app.get('/api/appointments', requireAuth, async (req, res) => {
  try {
    const { date, dateFrom, dateTo, provider, patient, patientId, status, departmentId } = req.query;
    const dashboard = await getDashboardAppointments({ date, dateFrom, dateTo, provider, patient, patientId, status, departmentId });
    res.json({ ok: true, appointments: dashboard.appointments, source: dashboard.source, message: dashboard.message });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const { date, dateFrom, dateTo, provider, patient, status, departmentId } = req.query;
    const dashboard = await getDashboardAppointments({ date, dateFrom, dateTo, provider, patient, status, departmentId });
    res.json({ ok: true, dashboard });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.get('/api/departments', requireAuth, async (req, res) => {
  try {
    const departments = await listDepartments();
    res.json({ ok: true, departments });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.post('/api/patients/intake/matches', requireAuth, async (req, res) => {
  try {
    const { firstName, lastName, dob, phone, email, memberId } = req.body || {};
    if (!firstName || !lastName || !dob) {
      return res.status(400).json({ ok: false, message: 'firstName, lastName, and dob are required to search for duplicates.' });
    }

    const matches = await searchAthenaPatients({ firstName, lastName, dob, phone, email, memberId });
    res.json({ ok: true, matches });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.post('/api/patients/intake', requireAuth, async (req, res) => {
  try {
    const { caseId, appointmentId, existingAthenaPatientId, forceCreate } = req.body || {};
    const intake = req.body?.patient || req.body || {};
    const requiredFields = ['firstName', 'lastName', 'dob', 'sex', 'phone', 'address1', 'city', 'state', 'zip', 'payerName'];
    const missingFields = requiredFields.filter((field) => !String(intake[field] || '').trim());
    if (missingFields.length) {
      return res.status(400).json({ ok: false, message: `Missing required fields: ${missingFields.join(', ')}` });
    }

    if (!existingAthenaPatientId && !forceCreate) {
      const matches = await searchAthenaPatients({
        firstName: intake.firstName,
        lastName: intake.lastName,
        dob: intake.dob,
        phone: intake.phone,
        email: intake.email,
        memberId: intake.memberId,
      });
      if (matches.length) {
        return res.status(409).json({ ok: false, message: 'Potential duplicate patient found in Athena.', matches });
      }
    }

    let athenaPatient = null;
    if (existingAthenaPatientId) {
      athenaPatient = await getAthenaPatientById(existingAthenaPatientId);
      if (!athenaPatient) {
        return res.status(404).json({ ok: false, message: 'The selected Athena patient could not be found.' });
      }
    } else {
      athenaPatient = await createAthenaPatient({
        firstName: intake.firstName,
        lastName: intake.lastName,
        dob: intake.dob,
        sex: intake.sex,
        address1: intake.address1,
        address2: intake.address2 || null,
        city: intake.city,
        state: intake.state,
        zip: intake.zip,
        phone: intake.phone,
        email: intake.email || null,
        payerName: intake.payerName,
        memberId: intake.memberId || null,
        groupNumber: intake.groupNumber || null,
        emergencyContactName: intake.emergencyContactName || null,
        emergencyContactPhone: intake.emergencyContactPhone || null,
        notes: intake.notes || null,
      });
    }

    if (!athenaPatient || !athenaPatient.id) {
      return res.status(502).json({ ok: false, message: 'Unable to create or resolve the Athena patient.' });
    }

    let linkedCase = null;
    if (caseId) {
      linkedCase = applyAthenaPatientLink(caseId, athenaPatient, 'linked');
      if (!linkedCase) {
        return res.status(404).json({ ok: false, message: 'Case not found for linking.' });
      }
    }

    const reference = upsertPatientReference({
      athenaPatientId: athenaPatient.id,
      caseId: caseId || null,
      appointmentId: appointmentId || null,
      createdBy: req.user?.name || null,
      source: existingAthenaPatientId ? 'linked-existing' : 'created',
    });

    res.status(existingAthenaPatientId ? 200 : 201).json({
      ok: true,
      created: !existingAthenaPatientId,
      athenaPatient,
      reference: reference.reference,
      case: linkedCase,
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

// Trigger an explicit appointment sync. If AUTO_CREATE_CASES=true, also
// auto-create local PatientCase records for newly seen appointments.
app.post('/api/appointments/sync', requireAuth, async (req, res) => {
  try {
    const { date, dateFrom, dateTo, provider, patient, status, departmentId } = req.body || req.query || {};
    const options = { date, dateFrom, dateTo, provider, patient, status, departmentId };

    const AUTO_CREATE_CASES = (() => {
      const raw = String(process.env.AUTO_CREATE_CASES || '').trim().toLowerCase();
      if (!raw) return true;
      return !['false', '0', 'no', 'off'].includes(raw);
    })();

    const dashboard = await getDashboardAppointments(options);

    let autoCreated = 0;
    if (AUTO_CREATE_CASES && Array.isArray(dashboard.appointments)) {
      for (const appointment of dashboard.appointments) {
        try {
          const result = createCase({ appointmentId: appointment.id, createdBy: req.user?.name || 'system-sync' });
          if (result.ok) {
            autoCreated += 1;
            // Attempt to link any existing Athena patientcase and carry through data.
            try {
              const athenaLink = await syncAthenaPatientCaseForAppointment(result.case);
              if (athenaLink && athenaLink.athenaPatientCase) {
                applyAthenaPatientCaseLink(result.case.id, athenaLink.athenaPatientCase, athenaLink.status);
                // If Athena provided a status that matches our CASE_STATUSES, adopt it.
                const athenaStatus = athenaLink.athenaPatientCase.status;
                if (athenaStatus && CASE_STATUSES.includes(athenaStatus)) {
                  updateCaseStatus(result.case.id, athenaStatus);
                }
              }
            } catch (err) {
              // Non-fatal: linking failure should not abort the sync.
              console.error('Failed to link Athena patient case during auto-create:', err?.message || err);
            }
          }
        } catch (err) {
          // Ignore per-appointment errors and continue.
          console.error('Error auto-creating case for appointment', appointment.id, err?.message || err);
        }
      }
    }

    res.json({ ok: true, appointmentsCount: dashboard.count || (dashboard.appointments && dashboard.appointments.length) || 0, autoCreatedCases: autoCreated, dashboard });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.get('/api/patients/:id', requireAuth, async (req, res) => {
  try {
    const patient = await getAthenaPatientById(req.params.id);
    if (!patient) {
      return res.status(404).json({ ok: false, message: 'Patient not found in Athena.' });
    }
    res.json({ ok: true, patient });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.get('/api/providers', requireAuth, async (req, res) => {
  try {
    const { departmentId } = req.query;
    const providers = await listProviders({ departmentId });
    res.json({ ok: true, providers });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.get('/api/cases', requireAuth, (req, res) => {
  if (!isPracticeAdmin(req.user, req.user.practiceId || defaultPracticeId())) return res.status(403).json({ ok: false, message: 'Admin access required.' });
  const { status, patient, provider, appointmentId } = req.query;
  res.json({ ok: true, cases: listCases({ status, patient, provider, appointmentId, practiceId: req.user.practiceId || defaultPracticeId() }), statuses: CASE_STATUSES, athenaLifecycleStatuses: ATHENA_LIFECYCLE_STATUSES, feed: getFeedHealth() });
});

app.get('/api/cases/statuses', requireAuth, (req, res) => {
  res.json({ ok: true, statuses: CASE_STATUSES });
});

app.post('/api/cases/athena-links/sync', requireAuth, requireAdmin, async (req, res) => {
  const practiceId = req.user.practiceId || defaultPracticeId();
  const cases = listCases({ practiceId }).filter((caseRecord) => !caseRecord.athenaPatientCaseId);
  const results = [];

  for (const caseRecord of cases) {
    const link = await ensureAthenaPatientCaseLink(caseRecord);
    applyAthenaPatientCaseLink(caseRecord.id, link.athenaPatientCase, link.status);
    results.push({ caseId: caseRecord.id, status: link.status, athenaPatientCaseId: link.athenaPatientCase?.id || null });
  }

  const linked = results.filter((result) => result.status === 'linked').length;
  res.json({ ok: true, checked: results.length, linked, unresolved: results.filter((result) => result.status !== 'linked'), results });
});

app.get('/api/cases/:id', requireAuth, (req, res) => {
  const caseRecord = getCase(req.params.id);
  if (!caseRecord) {
    return res.status(404).json({ ok: false, message: 'Case not found.' });
  }
  const allowedTransitions = ALLOWED_TRANSITIONS[caseRecord.status] || [];
  res.json({ ok: true, case: caseRecord, activity: listCaseActivity(req.params.id), allowedTransitions });
});

app.get('/api/cases/:id/activity', requireAuth, (req, res) => {
  const caseRecord = getCase(req.params.id);
  if (!caseRecord) {
    return res.status(404).json({ ok: false, message: 'Case not found.' });
  }
  res.json({ ok: true, activity: listCaseActivity(req.params.id) });
});

app.get('/api/admin/inbox', requireAuth, requireAdmin, (req, res) => {
  const limit = Number(req.query.limit || 50);
  res.json({ ok: true, entries: listAdminInbox({ limit: Number.isFinite(limit) && limit > 0 ? limit : 50 }) });
});

app.get('/api/admin/feed', requireAuth, requireAdmin, (req, res) => res.json({ ok: true, feed: getFeedHealth() }));
app.post('/api/admin/feed/sync', requireAuth, requireAdmin, async (req, res) => {
  const result = await drainChangeFeed();
  if (!result.ok) return res.status(result.status).json({ ok: false, message: result.message, feed: getFeedHealth() });
  let imported = 0;
  for (const event of consumeEvents()) {
    const item = event.patientCase || event.case || event.data || event;
    if (!item.patientName && !item.patientid && !item.patientId) continue;
    const created = createCase({ patientName: item.patientName || `Patient ${item.patientid || item.patientId}`, patientId: item.patientid || item.patientId, providerId: item.providerid || item.providerId, departmentId: item.departmentid || item.departmentId, department: item.department, createdBy: 'athena-change-feed', practiceId: req.user.practiceId || defaultPracticeId() });
    if (created.ok) { imported += 1; applyAthenaPatientCaseLink(created.case.id, { id: item.patientcaseid || item.patientCaseId || item.id, status: item.status, subject: item.subject, documentSubclass: item.documentsubclass, assignedTo: item.assignedto }, 'linked'); }
  }
  res.json({ ok: true, imported, feed: getFeedHealth() });
});

app.get('/api/admin/practice/members', requireAuth, requireAdmin, (req, res) => res.json({ ok: true, practiceId: req.user.practiceId || defaultPracticeId(), members: listMembers(req.user.practiceId || defaultPracticeId()) }));
app.patch('/api/admin/practice/members/:email', requireAuth, requireAdmin, (req, res) => {
  try { const member = setMemberRole({ practiceId: req.user.practiceId || defaultPracticeId(), email: req.params.email, role: req.body?.role, name: req.body?.name, organization: req.body?.organization }); res.json({ ok: true, member }); }
  catch (error) { res.status(400).json({ ok: false, message: error.message }); }
});

app.get('/api/cases/:id/audio/latest', requireAuth, (req, res) => {
  const recording = getLatestCaseAudio(req.params.id);
  if (!recording) {
    return res.status(404).json({ ok: false, message: 'No audio recording found for this case.' });
  }
  try {
    const audioPath = audioStorage.resolve(recording);
    if (!audioPath) return res.status(404).json({ ok: false, message: 'Audio file is unavailable.' });
    res.setHeader('Content-Type', recording.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${recording.fileName || 'case-audio'}"`);
    res.sendFile(path.basename(audioPath), { root: path.dirname(audioPath) });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

function handleCaseAudioUpload(req, res) {
  const caseId = req.params.id || req.body?.caseId;
  if (!caseId) {
    return res.status(400).json({ ok: false, message: 'caseId is required.' });
  }

  const result = attachCaseAudio(caseId, req.body || {}, req.user?.name || null);
  if (!result.ok) {
    return res.status(result.status).json({ ok: false, message: result.message });
  }

  const statusResult = updateCaseStatus(caseId, 'Voice Captured', req.user?.name || 'system');
  if (!statusResult.ok && statusResult.status !== 400) {
    console.error('Unable to advance case status after audio upload:', statusResult.message);
  }

  const persisted = getCase(caseId);
  const transcript = (persisted?.transcripts || []).find((item) => item.audioRecordingId === result.recording.id) || null;
  res.status(result.status).json({ ok: true, case: persisted || statusResult.case || result.case, audio: result.recording, transcript, message: 'Audio saved and transcription queued.' });
}

app.post('/api/cases/audio', requireAuth, handleCaseAudioUpload);
app.post('/api/cases/:id/audio', requireAuth, handleCaseAudioUpload);

app.delete('/api/cases/:id/audio/latest', requireAuth, (req, res) => {
  const result = discardLatestCaseAudio(req.params.id, req.user?.name || null);
  if (!result.ok) {
    return res.status(result.status).json({ ok: false, message: result.message });
  }
  res.json({ ok: true, case: result.case, recording: result.recording });
});

app.post('/api/cases/:id/notes', requireAuth, requireAdmin, async (req, res) => {
  const { note } = req.body || {};
  const caseRecord = getCase(req.params.id);
  if (!caseRecord) return res.status(404).json({ ok: false, message: 'Case not found.' });

  // Notes belong to the Scribel case first. Athena linkage is optional, so an
  // unlinked case must never prevent the team from documenting locally.
  const result = appendCaseNote(req.params.id, note, req.user?.name);
  if (!result.ok) {
    return res.status(result.status).json({ ok: false, message: result.message });
  }

  let athenaSync = 'not-linked';
  if (caseRecord.athenaPatientCaseId) {
    try {
      await appendAthenaPatientCaseActionNote({ patientId: caseRecord.patientId, patientCaseId: caseRecord.athenaPatientCaseId, departmentId: caseRecord.departmentId, note });
      athenaSync = 'synced';
    } catch (error) {
      // Keep the note in Scribel even when the external integration is down.
      athenaSync = 'failed';
      console.error('Unable to sync case note to Athena:', error.message);
    }
  }
  res.json({ ok: true, case: result.case, note: result.note, athenaSync });
});

async function processTranscript(caseId, transcriptId, actor) {
  const transcript = getTranscript(caseId, transcriptId);
  const caseRecord = getCase(caseId);
  if (!caseRecord || !transcript) return { ok: false, status: 404, message: 'Case or transcript not found.' };
  if (transcript.rawText) return { ok: false, status: 409, message: 'This transcript has already been transcribed. Review or clean it instead.', transcript };
  const recording = (caseRecord.audioRecordings || []).find((item) => item.id === transcript.audioRecordingId);
  const audioPath = audioStorage.resolve(recording);
  markTranscriptTranscribing(caseId, transcript.id, actor);
  updateCaseStatus(caseId, 'Transcript Cleaning', actor);
  try {
    const result = await transcribeAudio({ audioPath, mimeType: recording?.mimeType, language: transcript.language || 'en' });
    const raw = storeRawTranscript(caseId, transcript.id, result, actor);
    if (!raw.ok) return raw;
    const cleaned = cleanCaseTranscript(caseId, transcript.id, actor);
    if (!cleaned.ok) return cleaned;
    updateCaseStatus(caseId, 'Review Required', actor);
    return { ok: true, status: 200, transcript: getTranscript(caseId, transcript.id) };
  } catch (error) {
    failTranscript(caseId, transcript.id, error.message, actor);
    return { ok: false, status: 502, message: error.message, transcript: getTranscript(caseId, transcript.id) };
  }
}

app.post('/api/cases/:id/transcripts', requireAuth, async (req, res) => {
  const caseRecord = getCase(req.params.id);
  let transcriptId = req.body?.transcriptId || (caseRecord?.transcripts || []).at(-1)?.id;
  if (!transcriptId) {
    const queued = queueTranscriptForRecording(req.params.id, req.body?.audioRecordingId || null, req.user?.name || null);
    if (!queued.ok) return res.status(queued.status).json({ ok: false, message: queued.message });
    transcriptId = queued.transcript.id;
  }
  const result = await processTranscript(req.params.id, transcriptId, req.user?.name || null);
  res.status(result.status).json({ ok: result.ok, message: result.message || null, transcript: result.transcript || null });
});

app.get('/api/cases/:id/transcripts/latest', requireAuth, (req, res) => {
  const transcript = getTranscript(req.params.id);
  if (!transcript) return res.status(404).json({ ok: false, message: 'No transcript found for this case.' });
  res.json({ ok: true, transcript });
});

app.post('/api/cases/:id/transcripts/:transcriptId/clean', requireAuth, (req, res) => {
  const result = cleanCaseTranscript(req.params.id, req.params.transcriptId, req.user?.name || null);
  res.status(result.status).json({ ok: result.ok, message: result.message || null, transcript: result.transcript || null });
});

app.patch('/api/cases/:id/transcripts/:transcriptId', requireAuth, (req, res) => {
  const result = editCleanedTranscript(req.params.id, req.params.transcriptId, req.body?.cleanedText, req.user?.name || null);
  res.status(result.status).json({ ok: result.ok, message: result.message || null, transcript: result.transcript || null });
});

app.post('/api/cases/:id/transcripts/:transcriptId/approve', requireAuth, (req, res) => {
  const result = approveTranscript(req.params.id, req.params.transcriptId, req.user?.name || null);
  res.status(result.status).json({ ok: result.ok, message: result.message || null, transcript: result.transcript || null });
});

app.get('/api/cases/:id/prompt-input', requireAuth, (req, res) => {
  const result = getCasePromptInput(req.params.id, req.query.transcriptId || null);
  res.status(result.status).json({ ok: result.ok, message: result.message || null, input: result.input || null });
});

app.post('/api/cases/:id/actions', requireAuth, requireAdmin, (req, res) => {
  const { action, details } = req.body || {};
  if (!action || !String(action).trim()) {
    return res.status(400).json({ ok: false, message: 'Action type is required.' });
  }
  const result = recordCaseAction(req.params.id, String(action).trim(), req.user?.name, details || null);
  if (!result.ok) {
    return res.status(result.status).json({ ok: false, message: result.message });
  }
  res.json({ ok: true });
});

app.post('/api/cases', requireAuth, (req, res) => {
  (async () => {
    let {
      appointmentId,
      patientId,
      patientName,
      providerId,
      providerName,
      departmentId,
      department,
      appointmentDate,
      appointmentStartTime,
      reason,
      visitType,
    } = req.body || {};

    if (!appointmentId && (!patientId || !departmentId)) {
      return res.status(400).json({ ok: false, message: 'PatientId and departmentId are required for Athena-backed manual case creation.' });
    }

    let fallbackAppointment = null;
    if (!appointmentId && patientId && departmentId) {
      const cachedAppointments = getMockAppointments().filter((appt) => String(appt.patientId) === String(patientId));
      fallbackAppointment = cachedAppointments[0] || null;
      if (!fallbackAppointment) {
        const appointments = await getDashboardAppointments({ departmentId, patientId }).catch(() => ({ appointments: [] }));
        fallbackAppointment = (appointments.appointments || []).find((appt) => String(appt.patientId) === String(patientId)) || null;
      }

      if (fallbackAppointment) {
        appointmentId = String(fallbackAppointment.id);
        patientName = patientName || fallbackAppointment.patient || null;
        providerId = providerId || fallbackAppointment.providerId || null;
        providerName = providerName || fallbackAppointment.provider || null;
        department = department || fallbackAppointment.department || null;
        if (!appointmentDate) appointmentDate = fallbackAppointment.date || null;
        if (!appointmentStartTime) appointmentStartTime = fallbackAppointment.startTime || null;
        if (!reason) reason = fallbackAppointment.reason || null;
        if (!visitType) visitType = fallbackAppointment.visitType || null;
      }
    }

    if (!appointmentId && patientId && !patientName) {
      const patient = await getAthenaPatientById(patientId);
      if (patient) {
        patientName = patient.fullName;
      }
    }

    if (!appointmentId && providerId && !providerName) {
      const provider = await getAthenaProviderById(providerId);
      if (provider) {
        providerName = provider.displayName;
      }
    }

    if (!appointmentId && departmentId && !department) {
      const dept = await getAthenaDepartmentById(departmentId);
      if (dept) {
        department = dept.name;
      }
    }

    const shouldCreateAthenaCase = !appointmentId && patientId && providerId && departmentId;
    let athenaPatientCase = null;

    if (shouldCreateAthenaCase) {
      const subject = reason ? reason : `Manual patient case for ${patientName || 'patient'}`;
      const descriptionParts = [];
      if (visitType) descriptionParts.push(`Visit type: ${visitType}`);
      if (reason) descriptionParts.push(`Reason: ${reason}`);
      if (appointmentDate) {
        const formattedDate = new Date(appointmentDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        const formattedTime = appointmentStartTime ? appointmentStartTime.slice(11, 16) : null;
        descriptionParts.push(`Planned appointment date: ${formattedDate}${formattedTime ? ` ${formattedTime}` : ''}`);
      }
      const description = descriptionParts.join('\n');

      try {
        athenaPatientCase = await createAthenaPatientCase({
          patientId,
          departmentId,
          providerId,
          subject,
          description: description || undefined,
        });
      } catch (error) {
        athenaPatientCase = null;
      }
    }

    const result = createCase({
      appointmentId,
      patientId,
      patientName,
      providerId,
      providerName,
      departmentId,
      department,
      appointmentDate,
      appointmentStartTime,
      reason,
      visitType,
      createdBy: req.user?.name,
    });

    if (!result.ok) {
      return res.status(result.status).json({ ok: false, message: result.message, case: result.case });
    }

    let athenaLink = { status: 'not-linked', athenaPatientCase: null };
    if (athenaPatientCase) {
      athenaLink = { status: 'linked', athenaPatientCase };
      applyAthenaPatientCaseLink(result.case.id, athenaPatientCase, 'linked');
    } else {
      athenaLink = await ensureAthenaPatientCaseLink(result.case);
      applyAthenaPatientCaseLink(result.case.id, athenaLink.athenaPatientCase, athenaLink.status);
    }

    const persisted = getCase(result.case.id);
    res.status(result.status).json({
      ok: true,
      case: persisted || result.case,
      athenaPatientCase: athenaLink.athenaPatientCase,
      athenaPatientCaseSyncState: athenaLink.status,
    });
  })().catch((error) => {
    res.status(500).json({ ok: false, message: error.message });
  });
});

app.patch('/api/cases/:id/status', requireAuth, requireAdmin, (req, res) => {
  const { status } = req.body || {};
  const result = updateCaseStatus(req.params.id, status, req.user?.name || 'system');
  if (!result.ok) {
    return res.status(result.status).json({ ok: false, message: result.message });
  }
  res.json({ ok: true, case: result.case });
});

app.patch('/api/cases/:id/athena-lifecycle', requireAuth, requireAdmin, (req, res) => {
  const result = updateAthenaLifecycleStatus(req.params.id, req.body?.status, req.user?.name, req.body?.note);
  if (!result.ok) return res.status(result.status).json({ ok: false, message: result.message });
  res.json({ ok: true, case: result.case });
});
app.patch('/api/cases/:id/clinical-data', requireAuth, requireAdmin, (req, res) => {
  const result = updateClinicalData(req.params.id, req.body || {}, req.user?.name);
  if (!result.ok) return res.status(result.status).json({ ok: false, message: result.message });
  res.json({ ok: true, case: result.case });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Athena SSO demo running on http://localhost:${port}`);
  });
}

module.exports = { app };
