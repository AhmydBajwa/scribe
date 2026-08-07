const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'practice_members.json');
const defaultPracticeId = () => String(process.env.ATHENAHEALTH_PRACTICE_ID || 'default');

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) fs.writeFileSync(STORE_PATH, JSON.stringify({ members: [] }, null, 2));
}

function readStore() {
  ensureStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    return { members: Array.isArray(parsed.members) ? parsed.members : [] };
  } catch {
    return { members: [] };
  }
}

function writeStore(members) {
  ensureStore();
  const temp = `${STORE_PATH}.tmp`;
  fs.writeFileSync(temp, JSON.stringify({ members }, null, 2));
  fs.renameSync(temp, STORE_PATH);
}

function seedMember(user) {
  const practiceId = defaultPracticeId();
  const store = readStore();
  const email = String(user.email).toLowerCase();
  const index = store.members.findIndex((entry) => entry.practiceId === practiceId && entry.email === email);
  const record = {
    id: index >= 0 ? store.members[index].id : crypto.randomUUID(),
    practiceId,
    email,
    name: user.name,
    organization: user.organization || null,
    role: user.role === 'Clinic Administrator' ? 'admin' : 'member',
    updatedAt: new Date().toISOString(),
  };
  if (index >= 0) store.members[index] = { ...store.members[index], ...record };
  else store.members.push(record);
  writeStore(store.members);
  return record;
}

function getMemberships(email) {
  return readStore().members.filter((entry) => entry.email === String(email || '').toLowerCase());
}

function getUserForSession(user) {
  const membership = seedMember(user);
  const memberships = getMemberships(user.email);
  return {
    ...user,
    practiceId: membership.practiceId,
    practiceRoles: memberships.map(({ practiceId, role }) => ({ practiceId, role })),
    role: membership.role === 'admin' ? 'Clinic Administrator' : 'Care Coordinator',
  };
}

function isPracticeAdmin(user, practiceId = defaultPracticeId()) {
  const memberships = getMemberships(user?.email);
  // Compatibility for existing signed sessions created before the practice-role
  // store was introduced. New SAML sessions are always checked by membership.
  if (memberships.length === 0) return user?.role === 'Clinic Administrator';
  return memberships.some((entry) => entry.practiceId === String(practiceId) && entry.role === 'admin');
}

function listMembers(practiceId = defaultPracticeId()) {
  return readStore().members.filter((entry) => entry.practiceId === String(practiceId));
}

function setMemberRole({ practiceId = defaultPracticeId(), email, role, name, organization }) {
  if (!email || !['admin', 'member'].includes(role)) throw new Error('email and a role of admin or member are required.');
  const store = readStore();
  const normalizedEmail = String(email).toLowerCase();
  const index = store.members.findIndex((entry) => entry.practiceId === String(practiceId) && entry.email === normalizedEmail);
  const entry = {
    id: index >= 0 ? store.members[index].id : crypto.randomUUID(),
    practiceId: String(practiceId), email: normalizedEmail, role,
    name: name || (index >= 0 ? store.members[index].name : normalizedEmail),
    organization: organization || (index >= 0 ? store.members[index].organization : null),
    updatedAt: new Date().toISOString(),
  };
  if (index >= 0) store.members[index] = entry; else store.members.push(entry);
  writeStore(store.members);
  return entry;
}

module.exports = { defaultPracticeId, getUserForSession, isPracticeAdmin, listMembers, setMemberRole };
