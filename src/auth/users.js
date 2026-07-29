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

// Local IdP's user directory. Passwords are hashed (scrypt, random salt per
// user) even though this is a demo - shown on the login page for convenience
// since there's no separate account-provisioning flow.
const users = [
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
