const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { dataDirectory } = require('../config/runtime');

const DATA_DIR = dataDirectory();
const PATIENT_REFS_PATH = path.join(DATA_DIR, 'patient_refs.json');

const IS_TEST = !!(
  process.env.NODE_TEST === '1' ||
  process.env.NODE_TEST === 'true' ||
  Boolean(process.env.NODE_TEST_CONTEXT) ||
  process.env.npm_lifecycle_event === 'test' ||
  (process.argv && process.argv.includes('--test'))
);

let inMemoryStore = IS_TEST ? { refs: [] } : null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(PATIENT_REFS_PATH)) fs.writeFileSync(PATIENT_REFS_PATH, JSON.stringify({ refs: [] }, null, 2));
}

function readStore() {
  if (IS_TEST) {
    return inMemoryStore;
  }
  ensureDataDir();
  const raw = fs.readFileSync(PATIENT_REFS_PATH, 'utf8');
  return { refs: JSON.parse(raw).refs || [] };
}

function writeStore(refs) {
  if (IS_TEST) {
    inMemoryStore = { refs };
    return;
  }
  ensureDataDir();
  const tmpPath = `${PATIENT_REFS_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify({ refs }, null, 2));
  fs.renameSync(tmpPath, PATIENT_REFS_PATH);
}

function upsertPatientReference({ athenaPatientId, caseId = null, appointmentId = null, createdBy = null, source = 'intake' } = {}) {
  if (!athenaPatientId) {
    return { ok: false, status: 400, message: 'athenaPatientId is required.' };
  }

  const store = readStore();
  const existingIndex = store.refs.findIndex((ref) => String(ref.athenaPatientId) === String(athenaPatientId) && String(ref.caseId || '') === String(caseId || '') && String(ref.appointmentId || '') === String(appointmentId || ''));
  const now = new Date().toISOString();
  const entry = {
    id: existingIndex >= 0 ? store.refs[existingIndex].id : crypto.randomUUID(),
    athenaPatientId: String(athenaPatientId),
    caseId: caseId || null,
    appointmentId: appointmentId || null,
    createdBy: createdBy || null,
    source,
    createdAt: existingIndex >= 0 ? store.refs[existingIndex].createdAt : now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    store.refs[existingIndex] = entry;
  } else {
    store.refs.push(entry);
  }

  writeStore(store.refs);
  return { ok: true, status: 200, reference: Object.assign({}, entry) };
}

function listPatientReferences() {
  return readStore().refs.map((ref) => Object.assign({}, ref));
}

function resetPatientRefsForTests() {
  if (IS_TEST) {
    inMemoryStore = { refs: [] };
    return;
  }
  ensureDataDir();
  writeStore([]);
}

module.exports = {
  upsertPatientReference,
  listPatientReferences,
  resetPatientRefsForTests,
  isTestMode: IS_TEST,
};
