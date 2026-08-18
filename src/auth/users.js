const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hashHex] = stored.split(':');
  const hash = crypto.scryptSync(password, salt, 64);
  const storedHash = Buffer.from(hashHex, 'hex');
  if (hash.length !== storedHash.length) {
    return false;
  }
  return crypto.timingSafeEqual(hash, storedHash);
}

const developmentUsers = [
  {
    email: 'alex.morgan@northwindhealth.example',
    passwordHash: hashPassword('CoordinatorPass!23'),
    name: 'Alex Morgan',
    role: 'Care Coordinator',
    organization: 'Northwind Health',
  },
  {
    email: 'jordan.riley@northwindhealth.example',
    passwordHash: hashPassword('AdminPass!23'),
    name: 'Jordan Riley',
    role: 'Clinic Administrator',
    organization: 'Northwind Health',
  },
];

function loadUsers() {
  const encoded = process.env.SCRIBEL_USERS_JSON;
  if (!encoded) return process.env.NODE_ENV === 'production' ? [] : developmentUsers;
  let configured;
  try { configured = JSON.parse(encoded); } catch { throw new Error('SCRIBEL_USERS_JSON must contain a valid JSON array.'); }
  if (!Array.isArray(configured)) throw new Error('SCRIBEL_USERS_JSON must contain a JSON array.');
  return configured.map((user) => {
    if (!user.email || !user.name || !user.role || (!user.password && !user.passwordHash)) throw new Error('Each SCRIBEL_USERS_JSON user requires email, name, role, and password or passwordHash.');
    return { email: String(user.email).toLowerCase(), name: user.name, role: user.role, organization: user.organization || 'Scribel', passwordHash: user.passwordHash || hashPassword(String(user.password)) };
  });
}

const users = loadUsers();

function toPublicUser(user) {
  return { email: user.email, name: user.name, role: user.role, organization: user.organization };
}

function findUserByEmailInternal(email) {
  return users.find((user) => user.email.toLowerCase() === String(email || '').toLowerCase()) || null;
}

function authenticate(email, password) {
  const user = findUserByEmailInternal(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return null;
  }
  return toPublicUser(user);
}

function getPublicUserByEmail(email) {
  const user = findUserByEmailInternal(email);
  return user ? toPublicUser(user) : null;
}

function listDemoUsers() {
  return users.map((user) => ({ email: user.email, name: user.name, role: user.role }));
}

module.exports = { authenticate, getPublicUserByEmail, listDemoUsers };
