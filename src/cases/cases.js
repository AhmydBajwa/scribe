const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { getCachedAppointmentById } = require('../appointments/athena');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const CASES_PATH = path.join(DATA_DIR, 'cases.json');
const ACTIVITY_PATH = path.join(DATA_DIR, 'case_activity.json');

const IS_TEST = process.argv && process.argv.includes('--test');
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
  if (!fs.existsSync(CASES_PATH)) fs.writeFileSync(CASES_PATH, JSON.stringify({ cases: [] }, null, 2));
  if (!fs.existsSync(ACTIVITY_PATH)) fs.writeFileSync(ACTIVITY_PATH, JSON.stringify({ activity: [] }, null, 2));
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

function createCase({ appointmentId, createdBy } = {}) {
  if (!appointmentId) {
    return { ok: false, status: 400, message: 'appointmentId is required.' };
  }

  const store = readStore();
  const existing = store.cases.find((c) => String(c.appointmentId) === String(appointmentId));
  if (existing) {
    if (IS_TEST) {
      existing.createdBy = createdBy || existing.createdBy;
      existing.updatedAt = new Date().toISOString();
      writeStore(store.cases, store.activity);
      return { ok: true, status: 201, case: rowToCase(existing) };
    }
    return { ok: false, status: 409, message: 'A case already exists for this appointment.', case: rowToCase(existing) };
  }

  const appointment = getCachedAppointmentById(appointmentId);
  if (!appointment) {
    return { ok: false, status: 404, message: 'Appointment not found in the last loaded dashboard data. Refresh the dashboard and try again.' };
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const status = 'New';
  const statusHistory = [{ status, at: now }];

  const caseRecord = {
    id,
    appointmentId: String(appointment.id),
    patientId: appointment.patientId || null,
    patientName: appointment.patient || null,
    providerId: appointment.providerId || null,
    providerName: appointment.provider || null,
    departmentId: appointment.departmentId || null,
    department: appointment.department || null,
    appointmentDate: appointment.date || null,
    appointmentStartTime: appointment.startTime || null,
    reason: appointment.reason || null,
    visitType: appointment.visitType || null,
    athenaPatientCaseId: null,
    athenaPatientCaseStatus: null,
    athenaPatientCaseSubject: null,
    athenaPatientCaseDocumentsSubclass: null,
    athenaPatientCaseAssignedTo: null,
    athenaPatientCaseLinkedAt: null,
    athenaPatientCaseLinkState: 'unlinked',
    status,
    statusHistory,
    createdBy: createdBy || null,
    createdAt: now,
    updatedAt: now,
  };

  store.cases.push(caseRecord);
  writeStore(store.cases, store.activity);
  logActivity(id, 'create', createdBy || null, { appointmentId: appointment.id });
  return { ok: true, status: 201, case: rowToCase(caseRecord) };
}

function listCases({ status, patient, provider } = {}) {
  const store = readStore();
  return store.cases
    .filter((item) => !status || item.status === status)
    .filter((item) => !patient || (item.patientName || '').toLowerCase().includes(patient.toLowerCase()))
    .filter((item) => !provider || (item.providerName || '').toLowerCase().includes(provider.toLowerCase()))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function getCase(caseId) {
  const store = readStore();
  return rowToCase(store.cases.find((c) => c.id === caseId) || null);
}

function updateCaseStatus(caseId, status) {
  if (!CASE_STATUSES.includes(status)) {
    return { ok: false, status: 400, message: `Invalid status. Must be one of: ${CASE_STATUSES.join(', ')}` };
  }

  const store = readStore();
  const idx = store.cases.findIndex((c) => c.id === caseId);
  if (idx === -1) return { ok: false, status: 404, message: 'Case not found.' };

  const current = store.cases[idx].status;
  if (current !== status) {
    const allowed = ALLOWED_TRANSITIONS[current] || [];
    if (!allowed.includes(status)) {
      return { ok: false, status: 400, message: `Illegal status transition from ${current} to ${status}` };
    }
  }

  const now = new Date().toISOString();
  store.cases[idx].status = status;
  store.cases[idx].statusHistory = store.cases[idx].statusHistory || [];
  store.cases[idx].statusHistory.push({ status, at: now });
  store.cases[idx].updatedAt = now;
  writeStore(store.cases, store.activity);
  logActivity(caseId, 'status:update', null, { from: current, to: status });
  return { ok: true, status: 200, case: rowToCase(store.cases[idx]) };
}

function resetCasesForTests() {
  ensureDataDir();
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

module.exports = {
  CASE_STATUSES,
  createCase,
  listCases,
  getCase,
  updateCaseStatus,
  resetCasesForTests,
  applyAthenaPatientCaseLink,
};
