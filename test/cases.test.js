const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  CASE_STATUSES,
  createCase,
  listCases,
  getCase,
  listCaseActivity,
  listAdminInbox,
  logActivity,
  updateCaseStatus,
  resetCasesForTests,
} = require('../src/cases/cases');
const { getAppointmentsWithSource, resetAthenaCachesForTests } = require('../src/appointments/athena');
const { createSession } = require('../src/auth/saml');
const { app } = require('../server');

async function primeAppointmentCache() {
  const original = process.env.USE_MOCK_ATHENA;
  process.env.USE_MOCK_ATHENA = 'true';
  await getAppointmentsWithSource();
  process.env.USE_MOCK_ATHENA = original;
}

beforeEach(async () => {
  resetCasesForTests();
  resetAthenaCachesForTests();
  await primeAppointmentCache();
});

test('rejects case creation without an appointmentId or patientName', () => {
  const result = createCase({});
  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
});

test('creates a manual case when patientName is provided without an appointmentId', () => {
  const result = createCase({ patientName: 'New Patient', createdBy: 'Tester' });
  assert.equal(result.ok, true);
  assert.equal(result.status, 201);
  assert.equal(result.case.appointmentId, null);
  assert.equal(result.case.patientName, 'New Patient');
  assert.equal(result.case.status, 'New');
  assert.equal(result.case.createdBy, 'Tester');
});

test('rejects case creation for an appointment that is not in the cached dashboard data', () => {
  const result = createCase({ appointmentId: 'not-a-real-id' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
});

test('creates a case from a cached appointment and auto-fills patient/provider details', () => {
  const result = createCase({ appointmentId: 'apt-1001', createdBy: 'Tester' });
  assert.equal(result.ok, true);
  assert.equal(result.status, 201);
  assert.equal(result.case.appointmentId, 'apt-1001');
  assert.equal(result.case.patientName, 'Alicia Nguyen');
  assert.equal(result.case.providerName, 'Dr. Maya Patel');
  assert.equal(result.case.status, 'New');
  assert.equal(result.case.statusHistory.length, 1);
  assert.equal(result.case.createdBy, 'Tester');
});

test('prevents duplicate case creation for the same appointment', () => {
  const first = createCase({ appointmentId: 'apt-1002' });
  const second = createCase({ appointmentId: 'apt-1002' });

  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(second.status, 409);
  assert.equal(second.case.id, first.case.id);
  assert.equal(listCases().length, 1);
});

test('lists and filters cases by status/patient/provider', () => {
  createCase({ appointmentId: 'apt-1001' });
  createCase({ appointmentId: 'apt-1002' });

  assert.equal(listCases().length, 2);
  assert.equal(listCases({ patient: 'alicia' }).length, 1);
  assert.equal(listCases({ provider: 'daniel' }).length, 1);
  assert.equal(listCases({ status: 'New' }).length, 2);
});

test('retrieves a single case by id', () => {
  const created = createCase({ appointmentId: 'apt-1003' });
  const found = getCase(created.case.id);
  assert.equal(found.appointmentId, 'apt-1003');
  assert.equal(getCase('missing-id'), null);
});

test('updates case status, records history, and rejects unknown statuses', () => {
  const created = createCase({ appointmentId: 'apt-1001' });

  const badUpdate = updateCaseStatus(created.case.id, 'Not A Status');
  assert.equal(badUpdate.ok, false);
  assert.equal(badUpdate.status, 400);

  const goodUpdate = updateCaseStatus(created.case.id, 'Voice Pending');
  assert.equal(goodUpdate.ok, true);
  assert.equal(goodUpdate.case.status, 'Voice Pending');
  assert.equal(goodUpdate.case.statusHistory.length, 2);
  assert.equal(goodUpdate.case.statusHistory[1].status, 'Voice Pending');

  const missingCase = updateCaseStatus('missing-id', 'New');
  assert.equal(missingCase.ok, false);
  assert.equal(missingCase.status, 404);
});

test('records chronological activity entries and actor information', () => {
  const created = createCase({ appointmentId: 'apt-1001', createdBy: 'Tester' });
  const statusUpdate = updateCaseStatus(created.case.id, 'Voice Pending', 'Tester');

  assert.equal(statusUpdate.ok, true);
  const activity = listCaseActivity(created.case.id);
  assert.equal(activity.length, 2);
  assert.equal(activity[0].action, 'create');
  assert.equal(activity[0].actor, 'Tester');
  assert.equal(activity[1].action, 'status:update');
  assert.equal(activity[1].actor, 'Tester');
  assert.equal(activity[1].details.from, 'New');
  assert.equal(activity[1].details.to, 'Voice Pending');
});

test('defines the full Week 3 case status lifecycle in order', () => {
  assert.deepEqual(CASE_STATUSES, [
    'New',
    'Voice Pending',
    'Voice Captured',
    'Transcript Cleaning',
    'Prompt Processing',
    'Review Required',
    'Ready for Athena',
    'Sent to Athena',
    'Failed',
  ]);
});

test('exposes the case API over HTTP with auth and duplicate protection', async () => {
  const sessionId = createSession({ id: 'test-user', name: 'Test User', role: 'Clinic Administrator' });
  const server = app.listen(0);
  const { port } = server.address();
  const cookieHeader = `sessionId=${sessionId}`;

  try {
    const createRes = await fetch(`http://127.0.0.1:${port}/api/cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({ appointmentId: 'apt-1001' }),
    });
    const createPayload = await createRes.json();
    assert.equal(createRes.status, 201);
    assert.equal(createPayload.case.appointmentId, 'apt-1001');

    const duplicateRes = await fetch(`http://127.0.0.1:${port}/api/cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({ appointmentId: 'apt-1001' }),
    });
    assert.equal(duplicateRes.status, 409);

    const listRes = await fetch(`http://127.0.0.1:${port}/api/cases`, { headers: { Cookie: cookieHeader } });
    const listPayload = await listRes.json();
    assert.equal(listPayload.cases.length, 1);

    const detailRes = await fetch(`http://127.0.0.1:${port}/api/cases/${createPayload.case.id}`, {
      headers: { Cookie: cookieHeader },
    });
    assert.equal(detailRes.status, 200);

    const statusRes = await fetch(`http://127.0.0.1:${port}/api/cases/${createPayload.case.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({ status: 'Voice Pending' }),
    });
    const statusPayload = await statusRes.json();
    assert.equal(statusRes.status, 200);
    assert.equal(statusPayload.case.status, 'Voice Pending');

    const unauthedRes = await fetch(`http://127.0.0.1:${port}/api/cases`);
    assert.equal(unauthedRes.status, 401);
  } finally {
    server.close();
  }
});

test('links a created case to the matching Athena patientcase when live Athena data exists', async () => {
  const originalUseMock = process.env.USE_MOCK_ATHENA;
  const originalFetch = global.fetch;
  process.env.USE_MOCK_ATHENA = 'false';

  global.fetch = async (url) => {
    const target = url.toString();
    if (target.includes('/oauth2/v1/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'token', expires_in: 3600 }) };
    }
    if (target.includes('/patients/9001/documents/patientcase') || target.includes('/patients/9001/documents?')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          patientcases: [
            {
              patientcaseid: '240644',
              appointmentid: 'apt-1001',
              patientid: '9001',
              departmentid: '1',
              subject: 'New Patient Appointment Booked via scribeit.ai - preview',
              status: 'REVIEW',
              documentsubclass: 'PATIENTCASE_OTHER',
              assignedto: 'CRUICKSHANK HEALTH CARE STAFF',
              description: 'The patient booked an appointment from scribeit.ai - preview. Please verify...',
            },
          ],
        }),
      };
    }
    throw new Error(`Unexpected fetch to ${target}`);
  };

  const sessionId = createSession({ id: 'test-user', name: 'Test User' });
  const server = app.listen(0);
  const { port } = server.address();
  const cookieHeader = `sessionId=${sessionId}`;

  try {
    const createRes = await originalFetch(`http://127.0.0.1:${port}/api/cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({ appointmentId: 'apt-1001' }),
    });
    const payload = await createRes.json();

    assert.equal(createRes.status, 201);
    assert.equal(payload.case.athenaPatientCaseId, '240644');
    assert.equal(payload.case.athenaPatientCaseLinkState, 'linked');
    assert.equal(payload.case.athenaPatientCaseSubject, 'New Patient Appointment Booked via scribeit.ai - preview');
    assert.equal(payload.athenaPatientCase.id, '240644');
    assert.equal(payload.athenaPatientCaseSyncState, 'linked');
  } finally {
    server.close();
    global.fetch = originalFetch;
    process.env.USE_MOCK_ATHENA = originalUseMock;
  }
});

test('uploads case audio, stores metadata, and logs audio captured', async () => {
  const sessionId = createSession({ id: 'test-user', name: 'Test User', role: 'Clinic Administrator' });
  const server = app.listen(0);
  const { port } = server.address();
  const cookieHeader = `sessionId=${sessionId}`;

  try {
    const created = createCase({ appointmentId: 'apt-1001', createdBy: 'Test User' });
    const audioData = Buffer.from('sample voice audio').toString('base64');
    const uploadRes = await fetch(`http://127.0.0.1:${port}/api/cases/${created.case.id}/audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({
        audioData,
        mimeType: 'audio/webm',
        durationMs: 3210,
        recordedAt: new Date().toISOString(),
        source: 'dashboard',
        sizeBytes: Buffer.byteLength('sample voice audio'),
      }),
    });
    const payload = await uploadRes.json();

    assert.equal(uploadRes.status, 201);
    assert.equal(payload.audio.mimeType, 'audio/webm');
    assert.equal(payload.audio.source, 'dashboard');
    assert.equal(payload.audio.caseId, created.case.id);
    assert.equal(payload.case.audioRecordings.length, 1);

    const activity = listCaseActivity(created.case.id);
    assert.equal(activity.some((entry) => entry.action === 'audio:captured'), true);
  } finally {
    server.close();
  }
});

test('rejects audio upload requests without a case id or with oversized audio', async () => {
  const sessionId = createSession({ id: 'test-user', name: 'Test User', role: 'Clinic Administrator' });
  const server = app.listen(0);
  const { port } = server.address();
  const cookieHeader = `sessionId=${sessionId}`;

  try {
    const created = createCase({ appointmentId: 'apt-1001', createdBy: 'Test User' });
    const missingCaseRes = await fetch(`http://127.0.0.1:${port}/api/cases/audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({ audioData: Buffer.from('sample').toString('base64') }),
    });
    assert.equal(missingCaseRes.status, 400);

    const oversizedAudio = Buffer.alloc(51 * 1024 * 1024, 1).toString('base64');
    const oversizedRes = await fetch(`http://127.0.0.1:${port}/api/cases/${created.case.id}/audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({ audioData: oversizedAudio, mimeType: 'audio/webm' }),
    });
    assert.equal(oversizedRes.status, 413);
  } finally {
    server.close();
  }
});

test('returns a global admin inbox with recent admin activity', async () => {
  const sessionId = createSession({ id: 'test-user', name: 'Test User', role: 'Clinic Administrator' });
  const server = app.listen(0);
  const { port } = server.address();
  const cookieHeader = `sessionId=${sessionId}`;

  try {
    const created = createCase({ appointmentId: 'apt-1001', createdBy: 'Test User' });
    const noteRes = await fetch(`http://127.0.0.1:${port}/api/cases/${created.case.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({ note: 'Please review before handoff.' }),
    });
    assert.equal(noteRes.status, 200);

    const inboxRes = await fetch(`http://127.0.0.1:${port}/api/admin/inbox`, {
      headers: { Cookie: cookieHeader },
    });
    const inboxPayload = await inboxRes.json();

    assert.equal(inboxRes.status, 200);
    assert.ok(Array.isArray(inboxPayload.entries));
    assert.ok(inboxPayload.entries.some((entry) => entry.action === 'admin:note'));
  } finally {
    server.close();
  }
});

test('logs admin login activity to the global admin inbox', () => {
  logActivity(null, 'admin:login', 'Test Admin', { source: 'saml' });
  const inbox = listAdminInbox({ limit: 20 });

  assert.ok(Array.isArray(inbox));
  assert.ok(inbox.some((entry) => entry.action === 'admin:login' && entry.actor === 'Test Admin'));
});

test('auto-selects a matching appointment id for manual case creation when none is supplied', async () => {
  const sessionId = createSession({ id: 'test-user', name: 'Test User', role: 'Clinic Administrator' });
  const server = app.listen(0);
  const { port } = server.address();
  const cookieHeader = `sessionId=${sessionId}`;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({
        patientId: '9001',
        providerId: '1',
        departmentId: '1',
        reason: 'Follow-up refill',
        visitType: 'Follow-up',
        appointmentDate: '2026-08-01',
        appointmentStartTime: '2026-08-01T10:00:00',
      }),
    });
    const payload = await res.json();

    assert.equal(res.status, 201);
    assert.equal(payload.case.appointmentId, 'apt-1001');
    assert.equal(payload.case.patientName, 'Alicia Nguyen');
  } finally {
    server.close();
  }
});
