const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { getCachedAppointmentById } = require('../appointments/athena');
const audioStorage = require('./audioStorage');
const { cleanTranscript } = require('../transcripts/cleaning');
const { buildPromptInput } = require('../transcripts/promptInput');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const CASES_PATH = path.join(DATA_DIR, 'cases.json');
const ACTIVITY_PATH = path.join(DATA_DIR, 'case_activity.json');
const AUDIO_DIR = audioStorage.AUDIO_DIR;
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const DEFAULT_PRACTICE_ID = () => String(process.env.ATHENAHEALTH_PRACTICE_ID || 'default');
const ATHENA_LIFECYCLE_STATUSES = ['REVIEW', 'CLOSED'];

const IS_TEST = !!(
  process.env.NODE_TEST === '1' ||
  process.env.NODE_TEST === 'true' ||
  Boolean(process.env.NODE_TEST_CONTEXT) ||
  process.env.npm_lifecycle_event === 'test' ||
  (process.argv && process.argv.includes('--test'))
);
let inMemoryStore = IS_TEST ? { cases: [], activity: [] } : null;

const CASE_STATUSES = [
  'New',
  'Voice Pending',
  'Voice Captured',
  'Transcript Cleaning',
  'Prompt Processing',
  'Review Required',
  'Ready for Athena',
  'Sent to Athena',
  'Failed',
];

const ALLOWED_TRANSITIONS = {
  New: ['Voice Pending', 'Review Required', 'Failed', 'Ready for Athena', 'Sent to Athena'],
  'Voice Pending': ['Voice Captured', 'Transcript Cleaning', 'Failed'],
  'Voice Captured': ['Transcript Cleaning', 'Failed'],
  'Transcript Cleaning': ['Prompt Processing', 'Review Required', 'Failed'],
  'Prompt Processing': ['Review Required', 'Failed'],
  'Review Required': ['Ready for Athena', 'Failed'],
  'Ready for Athena': ['Sent to Athena', 'Failed'],
  'Sent to Athena': ['Failed'],
  Failed: ['Ready for Athena'],
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
  if (!fs.existsSync(CASES_PATH)) fs.writeFileSync(CASES_PATH, JSON.stringify({ cases: [] }, null, 2));
  if (!fs.existsSync(ACTIVITY_PATH)) fs.writeFileSync(ACTIVITY_PATH, JSON.stringify({ activity: [] }, null, 2));
}

function mimeToExtension(mimeType) {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.includes('webm')) return '.webm';
  if (normalized.includes('wav')) return '.wav';
  if (normalized.includes('ogg')) return '.ogg';
  if (normalized.includes('mp4') || normalized.includes('m4a')) return '.m4a';
  return '.dat';
}

const AUDIO_SOURCES = ['dashboard', 'mobile'];
const ALLOWED_AUDIO_MIME_TYPES = ['audio/webm', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/m4a'];

function isAllowedAudioMimeType(mimeType) {
  const normalized = String(mimeType || '').toLowerCase().split(';')[0].trim();
  return ALLOWED_AUDIO_MIME_TYPES.includes(normalized);
}

function decodeAudioPayload(audioData) {
  const raw = String(audioData || '').trim();
  if (!raw) {
    return null;
  }
  const base64 = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
  return Buffer.from(base64, 'base64');
}

function readStore() {
  if (IS_TEST) {
    return inMemoryStore;
  }
  ensureDataDir();
  const casesRaw = fs.readFileSync(CASES_PATH, 'utf8');
  const activityRaw = fs.readFileSync(ACTIVITY_PATH, 'utf8');
  return { cases: JSON.parse(casesRaw).cases || [], activity: JSON.parse(activityRaw).activity || [] };
}

function writeStore(cases, activity) {
  if (IS_TEST) {
    inMemoryStore = { cases, activity };
    return;
  }
  ensureDataDir();
  // atomic write via tmp file then rename
  const tmpCases = CASES_PATH + '.tmp';
  const tmpActivity = ACTIVITY_PATH + '.tmp';
  fs.writeFileSync(tmpCases, JSON.stringify({ cases }, null, 2));
  fs.renameSync(tmpCases, CASES_PATH);
  fs.writeFileSync(tmpActivity, JSON.stringify({ activity }, null, 2));
  fs.renameSync(tmpActivity, ACTIVITY_PATH);
}

function logActivity(caseId, action, actor, details) {
  try {
    const store = readStore();
    store.activity.push({ id: store.activity.length + 1, caseId, action, actor: actor || null, details: details || null, createdAt: new Date().toISOString() });
    writeStore(store.cases, store.activity);
  } catch (err) {
    console.error('Failed to write activity log', err?.message || err);
  }
}

function rowToCase(obj) {
  if (!obj) return null;
  return Object.assign({}, obj);
}

function createCase({ appointmentId, createdBy, patientId, patientName, providerId, providerName, departmentId, department, appointmentDate, appointmentStartTime, reason, visitType, practiceId = DEFAULT_PRACTICE_ID(), orders = [], diagnoses = [] } = {}) {
  const store = readStore();

  let encounterId = null;
  if (appointmentId) {
    const existing = store.cases.find((c) => String(c.appointmentId) === String(appointmentId));
    if (existing) {
      return { ok: false, status: 409, message: 'A case already exists for this appointment.', case: rowToCase(existing) };
    }

    const appointment = getCachedAppointmentById(appointmentId);
    if (!appointment) {
      return { ok: false, status: 404, message: 'Appointment not found in the last loaded dashboard data. Refresh the dashboard and try again.' };
    }

    patientId = appointment.patientId || null;
    patientName = appointment.patient || null;
    providerId = appointment.providerId || null;
    providerName = appointment.provider || null;
    departmentId = appointment.departmentId || null;
    department = appointment.department || null;
    appointmentDate = appointment.date || null;
    appointmentStartTime = appointment.startTime || null;
    reason = appointment.reason || null;
    visitType = appointment.visitType || null;
    encounterId = appointment.encounterId ? String(appointment.encounterId) : null;
  }

  if (!patientName && patientId) {
    patientName = String(patientId);
  }

  if (!appointmentId && !patientName) {
    return { ok: false, status: 400, message: 'patientName is required for a manual case.' };
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const workflowStage = 'New';
  const statusHistory = [{ status: workflowStage, at: now }];

  const caseRecord = {
    id,
    practiceId: String(practiceId),
    appointmentId: appointmentId ? String(appointmentId) : null,
    encounterId: encounterId || null,
    patientId: patientId || null,
    patientName: patientName || null,
    providerId: providerId || null,
    providerName: providerName || null,
    departmentId: departmentId || null,
    department: department || null,
    appointmentDate: appointmentDate || null,
    appointmentStartTime: appointmentStartTime || null,
    reason: reason || null,
    visitType: visitType || null,
    athenaPatientCaseId: null,
    athenaPatientCaseStatus: null,
    athenaPatientCaseSubject: null,
    athenaPatientCaseDocumentsSubclass: null,
    athenaPatientCaseAssignedTo: null,
    athenaPatientCaseLinkedAt: null,
    athenaPatientCaseLinkState: 'unlinked',
    athenaPatientId: null,
    athenaPatientLinkedAt: null,
    athenaPatientLinkState: 'unlinked',
    audioRecordings: [],
    transcripts: [],
    // `status` remains for API compatibility; workflowStage is the display
    // lifecycle while athenaLifecycleStatus mirrors only Athena concepts.
    status: workflowStage,
    workflowStage,
    athenaLifecycleStatus: 'REVIEW',
    athenaLifecycleHistory: [{ status: 'REVIEW', at: now }],
    statusHistory,
    notes: [],
    orders: Array.isArray(orders) ? orders : [],
    diagnoses: Array.isArray(diagnoses) ? diagnoses : [],
    createdBy: createdBy || null,
    createdAt: now,
    updatedAt: now,
  };

  store.cases.push(caseRecord);
  writeStore(store.cases, store.activity);
  logActivity(id, 'create', createdBy || null, { appointmentId: appointmentId ? String(appointmentId) : null, patientName: patientName || null });
  return { ok: true, status: 201, case: rowToCase(caseRecord) };
}

function listCases({ status, patient, provider, appointmentId, practiceId } = {}) {
  const store = readStore();
  return store.cases
    .filter((item) => !practiceId || String(item.practiceId || DEFAULT_PRACTICE_ID()) === String(practiceId))
    .filter((item) => !status || (item.workflowStage || item.status) === status)
    .filter((item) => !patient || (item.patientName || '').toLowerCase().includes(patient.toLowerCase()))
    .filter((item) => !provider || (item.providerName || '').toLowerCase().includes(provider.toLowerCase()))
    .filter((item) => !appointmentId || String(item.appointmentId) === String(appointmentId))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function getCase(caseId) {
  const store = readStore();
  return rowToCase(store.cases.find((c) => c.id === caseId) || null);
}

function listCaseActivity(caseId) {
  const store = readStore();
  return store.activity
    .filter((entry) => String(entry.caseId) === String(caseId))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((entry) => Object.assign({}, entry));
}

function listAdminInbox({ limit = 100 } = {}) {
  const store = readStore();
  return store.activity
    .filter((entry) => {
      const action = String(entry.action || '');
      const actor = String(entry.actor || '');
      const isAdminRelevant = action.startsWith('admin:') || action === 'status:update' || action === 'create' || action === 'audio:captured' || action === 'audio:discarded' || action === 'transcript:cleaned' || action === 'athena:link' || action === 'athena:unlink' || action === 'athena-patient:link' || action === 'athena-patient:unlink';
      return Boolean(actor) || isAdminRelevant;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit)
    .map((entry) => {
      const caseRecord = store.cases.find((item) => String(item.id) === String(entry.caseId)) || null;
      return {
        ...entry,
        case: caseRecord ? rowToCase(caseRecord) : null,
      };
    });
}

function appendCaseNote(caseId, note, author) {
  if (!note || !String(note).trim()) {
    return { ok: false, status: 400, message: 'Note text is required.' };
  }

  const store = readStore();
  const idx = store.cases.findIndex((c) => c.id === caseId);
  if (idx === -1) {
    return { ok: false, status: 404, message: 'Case not found.' };
  }

  const now = new Date().toISOString();
  store.cases[idx].notes = store.cases[idx].notes || [];
  const noteEntry = {
    id: `${caseId}-note-${store.cases[idx].notes.length + 1}`,
    text: String(note).trim(),
    author: author || null,
    createdAt: now,
  };
  store.cases[idx].notes.push(noteEntry);
  store.cases[idx].updatedAt = now;
  writeStore(store.cases, store.activity);
  logActivity(caseId, 'admin:note', author || null, { note: noteEntry.text });

  return { ok: true, status: 200, case: rowToCase(store.cases[idx]), note: noteEntry };
}

function recordCaseAction(caseId, action, actor, details = null) {
  const store = readStore();
  const existing = store.cases.find((c) => c.id === caseId);
  if (!existing) {
    return { ok: false, status: 404, message: 'Case not found.' };
  }

  logActivity(caseId, action, actor || null, details);
  return { ok: true, status: 200 };
}

function updateCaseStatus(caseId, status, actor = null) {
  if (!CASE_STATUSES.includes(status)) {
    return { ok: false, status: 400, message: `Invalid status. Must be one of: ${CASE_STATUSES.join(', ')}` };
  }

  const store = readStore();
  const idx = store.cases.findIndex((c) => c.id === caseId);
  if (idx === -1) return { ok: false, status: 404, message: 'Case not found.' };

  const current = store.cases[idx].workflowStage || store.cases[idx].status;
  if (current !== status) {
    const allowed = ALLOWED_TRANSITIONS[current] || [];
    if (!allowed.includes(status)) {
      return { ok: false, status: 400, message: `Illegal status transition from ${current} to ${status}` };
    }
  }

  const now = new Date().toISOString();
  store.cases[idx].status = status;
  store.cases[idx].workflowStage = status;
  store.cases[idx].statusHistory = store.cases[idx].statusHistory || [];
  store.cases[idx].statusHistory.push({ status, at: now });
  store.cases[idx].updatedAt = now;
  writeStore(store.cases, store.activity);
  logActivity(caseId, 'status:update', actor || 'system', { from: current, to: status });
  return { ok: true, status: 200, case: rowToCase(store.cases[idx]) };
}

function updateAthenaLifecycleStatus(caseId, status, actor = null, note = null) {
  if (!ATHENA_LIFECYCLE_STATUSES.includes(status)) return { ok: false, status: 400, message: 'Athena lifecycle status must be REVIEW or CLOSED.' };
  const store = readStore(); const idx = store.cases.findIndex((item) => item.id === caseId);
  if (idx === -1) return { ok: false, status: 404, message: 'Case not found.' };
  const current = store.cases[idx].athenaLifecycleStatus || 'REVIEW';
  store.cases[idx].athenaLifecycleStatus = status;
  store.cases[idx].athenaLifecycleHistory = store.cases[idx].athenaLifecycleHistory || [];
  store.cases[idx].athenaLifecycleHistory.push({ status, at: new Date().toISOString(), note: note || null });
  store.cases[idx].updatedAt = new Date().toISOString(); writeStore(store.cases, store.activity);
  logActivity(caseId, status === 'CLOSED' ? 'athena:closed' : current === 'CLOSED' ? 'athena:reopened' : 'athena:review', actor, { from: current, to: status, note: note || null });
  return { ok: true, status: 200, case: rowToCase(store.cases[idx]) };
}

function updateClinicalData(caseId, { orders, diagnoses } = {}, actor = null) {
  const store = readStore(); const idx = store.cases.findIndex((item) => item.id === caseId);
  if (idx === -1) return { ok: false, status: 404, message: 'Case not found.' };
  if (orders !== undefined) store.cases[idx].orders = Array.isArray(orders) ? orders : [];
  if (diagnoses !== undefined) store.cases[idx].diagnoses = Array.isArray(diagnoses) ? diagnoses : [];
  store.cases[idx].updatedAt = new Date().toISOString(); writeStore(store.cases, store.activity);
  logActivity(caseId, 'clinical-data:update', actor, { ordersUpdated: orders !== undefined, diagnosesUpdated: diagnoses !== undefined });
  return { ok: true, status: 200, case: rowToCase(store.cases[idx]) };
}

function attachCaseAudio(caseId, { audioData, mimeType, durationMs, recordedAt, fileName, source } = {}, actor = null) {
  const buffer = decodeAudioPayload(audioData);
  if (!buffer) {
    return { ok: false, status: 400, message: 'Audio data is required.' };
  }
  if (buffer.length > MAX_AUDIO_BYTES) {
    return { ok: false, status: 413, message: `Audio file is too large. Maximum size is ${Math.round(MAX_AUDIO_BYTES / (1024 * 1024))}MB.` };
  }
  if (!isAllowedAudioMimeType(mimeType)) {
    return { ok: false, status: 415, message: `Unsupported audio type. Use one of: ${ALLOWED_AUDIO_MIME_TYPES.join(', ')}` };
  }
  if (!AUDIO_SOURCES.includes(source)) {
    return { ok: false, status: 400, message: 'source must be dashboard or mobile.' };
  }
  if (durationMs != null && (!Number.isFinite(Number(durationMs)) || Number(durationMs) < 0 || Number(durationMs) > 10 * 60 * 1000)) {
    return { ok: false, status: 400, message: 'durationMs must be between 0 and 600000.' };
  }

  const store = readStore();
  const idx = store.cases.findIndex((c) => c.id === caseId);
  if (idx === -1) {
    return { ok: false, status: 404, message: 'Case not found.' };
  }

  const now = new Date().toISOString();
  const recordingId = crypto.randomUUID();
  const extension = mimeToExtension(mimeType);
  const safeRecordedAt = recordedAt || now;
  const storage = audioStorage.save({ caseId, recordingId, extension, buffer });

  const recording = {
    id: recordingId,
    caseId: String(caseId),
    source,
    mimeType: mimeType || 'application/octet-stream',
    fileName: fileName || storage.storedFileName,
    storageKey: storage.storageKey,
    storedFileName: storage.storedFileName,
    storedFilePath: storage.storedFilePath,
    sizeBytes: buffer.length,
    durationMs: durationMs !== undefined && durationMs !== null ? Number(durationMs) : null,
    recordedAt: safeRecordedAt,
    uploadedAt: now,
    uploadedBy: actor || null,
    url: `/api/cases/${caseId}/audio/latest`,
  };

  store.cases[idx].audioRecordings = Array.isArray(store.cases[idx].audioRecordings) ? store.cases[idx].audioRecordings : [];
  store.cases[idx].audioRecordings.push(recording);
  const transcript = {
    id: crypto.randomUUID(), caseId: String(caseId), audioRecordingId: recording.id,
    status: 'queued', rawText: null, cleanedText: null, speakerSections: [], transcriptProvider: null,
    language: 'en', confidence: null, cleaningMetadata: null, createdAt: now, transcribedAt: null,
    cleanedAt: null, reviewedAt: null, reviewedBy: null, failureMessage: null,
  };
  store.cases[idx].transcripts = Array.isArray(store.cases[idx].transcripts) ? store.cases[idx].transcripts : [];
  store.cases[idx].transcripts.push(transcript);
  store.cases[idx].latestAudioRecordingId = recording.id;
  store.cases[idx].updatedAt = now;

  writeStore(store.cases, store.activity);
  logActivity(caseId, 'audio:captured', actor || null, {
    audioId: recording.id,
    mimeType: recording.mimeType,
    sizeBytes: recording.sizeBytes,
    durationMs: recording.durationMs,
    recordedAt: recording.recordedAt,
    source: recording.source,
  });
  logActivity(caseId, 'transcript:queued', actor || null, { transcriptId: transcript.id, sourceAudioId: recording.id });

  return { ok: true, status: 201, case: rowToCase(store.cases[idx]), recording };
}

function getTranscript(caseId, transcriptId = null) {
  const caseRecord = getCase(caseId);
  if (!caseRecord) return null;
  const transcripts = Array.isArray(caseRecord.transcripts) ? caseRecord.transcripts : [];
  const transcript = transcriptId ? transcripts.find((item) => item.id === transcriptId) : transcripts[transcripts.length - 1];
  return transcript ? Object.assign({}, transcript) : null;
}

function queueTranscriptForRecording(caseId, audioRecordingId = null, actor = null) {
  const store = readStore(); const caseIndex = store.cases.findIndex((item) => item.id === caseId);
  if (caseIndex === -1) return { ok: false, status: 404, message: 'Case not found.' };
  const recordings = Array.isArray(store.cases[caseIndex].audioRecordings) ? store.cases[caseIndex].audioRecordings : [];
  const recording = audioRecordingId ? recordings.find((item) => item.id === audioRecordingId) : recordings[recordings.length - 1];
  if (!recording) return { ok: false, status: 409, message: 'Upload audio before queuing a transcript.' };
  const transcripts = Array.isArray(store.cases[caseIndex].transcripts) ? store.cases[caseIndex].transcripts : [];
  const existing = transcripts.find((item) => item.audioRecordingId === recording.id);
  if (existing) return { ok: true, status: 200, transcript: Object.assign({}, existing), case: rowToCase(store.cases[caseIndex]) };
  const now = new Date().toISOString();
  const transcript = {
    id: crypto.randomUUID(), caseId: String(caseId), audioRecordingId: recording.id,
    status: 'queued', rawText: null, cleanedText: null, speakerSections: [], transcriptProvider: null,
    language: 'en', confidence: null, cleaningMetadata: null, createdAt: now, transcribedAt: null,
    cleanedAt: null, reviewedAt: null, reviewedBy: null, failureMessage: null,
  };
  transcripts.push(transcript); store.cases[caseIndex].transcripts = transcripts; store.cases[caseIndex].updatedAt = now;
  writeStore(store.cases, store.activity); logActivity(caseId, 'transcript:queued', actor || null, { transcriptId: transcript.id, sourceAudioId: recording.id, backfilled: true });
  return { ok: true, status: 201, transcript: Object.assign({}, transcript), case: rowToCase(store.cases[caseIndex]) };
}

function setTranscriptState(caseId, transcriptId, patch, actor = null, action = null, details = null) {
  const store = readStore(); const caseIndex = store.cases.findIndex((item) => item.id === caseId);
  if (caseIndex === -1) return { ok: false, status: 404, message: 'Case not found.' };
  const transcripts = store.cases[caseIndex].transcripts || [];
  const transcriptIndex = transcripts.findIndex((item) => item.id === transcriptId);
  if (transcriptIndex === -1) return { ok: false, status: 404, message: 'Transcript not found.' };
  transcripts[transcriptIndex] = { ...transcripts[transcriptIndex], ...patch };
  store.cases[caseIndex].transcripts = transcripts; store.cases[caseIndex].updatedAt = new Date().toISOString(); writeStore(store.cases, store.activity);
  if (action) logActivity(caseId, action, actor, { transcriptId, ...(details || {}) });
  return { ok: true, status: 200, transcript: Object.assign({}, transcripts[transcriptIndex]), case: rowToCase(store.cases[caseIndex]) };
}

function markTranscriptTranscribing(caseId, transcriptId, actor) {
  return setTranscriptState(caseId, transcriptId, { status: 'transcribing', failureMessage: null }, actor, 'transcript:transcribing');
}

function storeRawTranscript(caseId, transcriptId, { text, segments, confidence, provider, language } = {}, actor) {
  const current = getTranscript(caseId, transcriptId);
  if (!current) return { ok: false, status: 404, message: 'Transcript not found.' };
  if (current.rawText) return { ok: false, status: 409, message: 'Raw transcript is immutable once stored.' };
  const now = new Date().toISOString();
  return setTranscriptState(caseId, transcriptId, { status: 'raw-ready', rawText: String(text || ''), speakerSections: Array.isArray(segments) ? segments : [], confidence: confidence ?? null, transcriptProvider: provider || null, language: language || 'en', transcribedAt: now }, actor, 'transcript:raw-ready');
}

function cleanCaseTranscript(caseId, transcriptId, actor) {
  const current = getTranscript(caseId, transcriptId);
  if (!current) return { ok: false, status: 404, message: 'Transcript not found.' };
  if (!current.rawText) return { ok: false, status: 409, message: 'Raw transcript is not ready.' };
  const cleaned = cleanTranscript(current.rawText); const now = new Date().toISOString();
  return setTranscriptState(caseId, transcriptId, { status: 'review-required', cleanedText: cleaned.cleanedText, cleaningMetadata: { rulesApplied: cleaned.rulesApplied, cleanerVersion: cleaned.cleanerVersion }, cleanedAt: now }, actor, 'transcript:cleaned', { rulesApplied: cleaned.rulesApplied });
}

function editCleanedTranscript(caseId, transcriptId, cleanedText, actor) {
  if (!String(cleanedText || '').trim()) return { ok: false, status: 400, message: 'Cleaned transcript text is required.' };
  const current = getTranscript(caseId, transcriptId);
  if (!current) return { ok: false, status: 404, message: 'Transcript not found.' };
  if (!current.rawText) return { ok: false, status: 409, message: 'Raw transcript is not ready.' };
  return setTranscriptState(caseId, transcriptId, { status: 'review-required', cleanedText: String(cleanedText).trim(), cleanedAt: new Date().toISOString() }, actor, 'transcript:edited');
}

function approveTranscript(caseId, transcriptId, actor) {
  const current = getTranscript(caseId, transcriptId);
  if (!current) return { ok: false, status: 404, message: 'Transcript not found.' };
  if (!current.cleanedText) return { ok: false, status: 409, message: 'Cleaned transcript is required before approval.' };
  return setTranscriptState(caseId, transcriptId, { status: 'approved', reviewedAt: new Date().toISOString(), reviewedBy: actor || null }, actor, 'transcript:approved');
}

function failTranscript(caseId, transcriptId, error, actor) { return setTranscriptState(caseId, transcriptId, { status: 'failed', failureMessage: error || 'Transcription failed.' }, actor, 'transcript:failed', { message: error }); }

function getCasePromptInput(caseId, transcriptId = null) {
  const caseRecord = getCase(caseId); if (!caseRecord) return { ok: false, status: 404, message: 'Case not found.' };
  const transcript = getTranscript(caseId, transcriptId); if (!transcript) return { ok: false, status: 404, message: 'Transcript not found.' };
  try { return { ok: true, status: 200, input: buildPromptInput(caseRecord, transcript) }; } catch (error) { return { ok: false, status: 409, message: error.message }; }
}

function getLatestCaseAudio(caseId) {
  const store = readStore();
  const caseRecord = store.cases.find((c) => c.id === caseId);
  if (!caseRecord || !Array.isArray(caseRecord.audioRecordings) || caseRecord.audioRecordings.length === 0) {
    return null;
  }
  return Object.assign({}, caseRecord.audioRecordings[caseRecord.audioRecordings.length - 1]);
}

function discardLatestCaseAudio(caseId, actor = null) {
  const store = readStore();
  const idx = store.cases.findIndex((c) => c.id === caseId);
  if (idx === -1) {
    return { ok: false, status: 404, message: 'Case not found.' };
  }

  const recordings = Array.isArray(store.cases[idx].audioRecordings) ? store.cases[idx].audioRecordings : [];
  const recording = recordings.pop();
  if (!recording) {
    return { ok: false, status: 404, message: 'No audio recording found for this case.' };
  }

  try {
    audioStorage.remove(recording);
  } catch (err) {
    console.error('Failed to remove case audio file', err?.message || err);
  }

  store.cases[idx].audioRecordings = recordings;
  store.cases[idx].latestAudioRecordingId = recordings.length ? recordings[recordings.length - 1].id : null;
  store.cases[idx].updatedAt = new Date().toISOString();
  writeStore(store.cases, store.activity);
  logActivity(caseId, 'audio:discarded', actor, { audioId: recording.id });

  return { ok: true, status: 200, case: rowToCase(store.cases[idx]), recording };
}

function resetCasesForTests() {
  if (!IS_TEST) return;
  ensureDataDir();
  try {
    fs.rmSync(AUDIO_DIR, { recursive: true, force: true });
  } catch (err) {
    // Non-fatal cleanup for tests.
  }
  writeStore([], []);
}

function applyAthenaPatientCaseLink(caseId, athenaPatientCase, linkState = 'linked') {
  const store = readStore();
  const idx = store.cases.findIndex((c) => c.id === caseId);
  if (idx === -1) return null;

  if (!athenaPatientCase) {
    store.cases[idx].athenaPatientCaseId = null;
    store.cases[idx].athenaPatientCaseStatus = null;
    store.cases[idx].athenaPatientCaseSubject = null;
    store.cases[idx].athenaPatientCaseDocumentsSubclass = null;
    store.cases[idx].athenaPatientCaseAssignedTo = null;
    store.cases[idx].athenaPatientCaseLinkedAt = null;
    store.cases[idx].athenaPatientCaseLinkState = linkState || 'not-found';
    store.cases[idx].updatedAt = new Date().toISOString();
    writeStore(store.cases, store.activity);
    logActivity(caseId, 'athena:unlink', null, { linkState });
    return rowToCase(store.cases[idx]);
  }

  store.cases[idx].athenaPatientCaseId = athenaPatientCase.id || null;
  store.cases[idx].athenaPatientCaseStatus = athenaPatientCase.status || null;
  store.cases[idx].athenaPatientCaseSubject = athenaPatientCase.subject || null;
  store.cases[idx].athenaPatientCaseDocumentsSubclass = athenaPatientCase.documentSubclass || null;
  store.cases[idx].athenaPatientCaseAssignedTo = athenaPatientCase.assignedTo || null;
  store.cases[idx].athenaPatientCaseLinkedAt = new Date().toISOString();
  store.cases[idx].athenaPatientCaseLinkState = 'linked';
  store.cases[idx].updatedAt = store.cases[idx].athenaPatientCaseLinkedAt;
  writeStore(store.cases, store.activity);
  logActivity(caseId, 'athena:link', null, { athenaPatientCaseId: athenaPatientCase.id });
  return rowToCase(store.cases[idx]);
}

function applyAthenaPatientLink(caseId, athenaPatient, linkState = 'linked') {
  const store = readStore();
  const idx = store.cases.findIndex((c) => c.id === caseId);
  if (idx === -1) return null;

  if (!athenaPatient) {
    store.cases[idx].athenaPatientId = null;
    store.cases[idx].athenaPatientLinkedAt = null;
    store.cases[idx].athenaPatientLinkState = linkState || 'not-found';
    store.cases[idx].updatedAt = new Date().toISOString();
    writeStore(store.cases, store.activity);
    logActivity(caseId, 'athena-patient:unlink', null, { linkState });
    return rowToCase(store.cases[idx]);
  }

  store.cases[idx].athenaPatientId = athenaPatient.id || null;
  store.cases[idx].athenaPatientLinkedAt = new Date().toISOString();
  store.cases[idx].athenaPatientLinkState = 'linked';
  store.cases[idx].updatedAt = store.cases[idx].athenaPatientLinkedAt;
  writeStore(store.cases, store.activity);
  logActivity(caseId, 'athena-patient:link', null, { athenaPatientId: athenaPatient.id });
  return rowToCase(store.cases[idx]);
}

module.exports = {
  CASE_STATUSES,
  AUDIO_SOURCES,
  ALLOWED_AUDIO_MIME_TYPES,
  ATHENA_LIFECYCLE_STATUSES,
  ALLOWED_TRANSITIONS,
  createCase,
  listCases,
  getCase,
  listCaseActivity,
  listAdminInbox,
  appendCaseNote,
  recordCaseAction,
  updateCaseStatus,
  updateAthenaLifecycleStatus,
  updateClinicalData,
  attachCaseAudio,
  getTranscript,
  queueTranscriptForRecording,
  markTranscriptTranscribing,
  storeRawTranscript,
  cleanCaseTranscript,
  editCleanedTranscript,
  approveTranscript,
  failTranscript,
  getCasePromptInput,
  getLatestCaseAudio,
  discardLatestCaseAudio,
  resetCasesForTests,
  applyAthenaPatientCaseLink,
  applyAthenaPatientLink,
  logActivity,
  isTestMode: IS_TEST,
};
