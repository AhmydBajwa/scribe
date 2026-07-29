const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const selfsigned = require('selfsigned');

const CERT_DIR = path.join(__dirname, '..', '..', 'certs');
const KEY_PATH = path.join(CERT_DIR, 'idp-key.pem');
const CERT_PATH = path.join(CERT_DIR, 'idp-cert.pem');
const LOCK_PATH = path.join(CERT_DIR, '.idp-cert.lock');

function stripPemArmor(pem) {
  return pem.replace(/-----BEGIN [^-]+-----/, '').replace(/-----END [^-]+-----/, '').replace(/\r?\n/g, '').trim();
}

function readFromDisk() {
  const privateKey = fs.readFileSync(KEY_PATH, 'utf8');
  const certPem = fs.readFileSync(CERT_PATH, 'utf8');
  return { privateKey, signingCert: stripPemArmor(certPem) };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Certs are generated once and persisted to disk. Multiple processes (e.g.
// concurrent test-file workers on a fresh checkout, before certs/ exists)
// could race here, so the actual generation is guarded by an exclusive-create
// lock file (`wx` flag - atomic at the OS level on both Windows and POSIX).
// The loser(s) just poll briefly for the winner to finish instead of also
// generating, which would otherwise risk two processes writing a mismatched
// key/cert pair into the same two files.
async function loadOrCreateIdpCertificate() {
  if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
    return readFromDisk();
  }

  fs.mkdirSync(CERT_DIR, { recursive: true });

  let haveLock = false;
  try {
    fs.writeFileSync(LOCK_PATH, String(process.pid), { flag: 'wx' });
    haveLock = true;
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }

  if (haveLock) {
    try {
      const pems = await selfsigned.generate(
        [{ name: 'commonName', value: 'athena-sso-demo-local-idp' }],
        { days: 3650, keySize: 2048 }
      );
      fs.writeFileSync(KEY_PATH, pems.private);
      fs.writeFileSync(CERT_PATH, pems.cert);
    } finally {
      fs.rmSync(LOCK_PATH, { force: true });
    }
    return readFromDisk();
  }

  const deadline = Date.now() + 10000;
  while (!(fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH))) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for another process to finish generating the IdP certificate.');
    }
    await sleep(100);
  }
  return readFromDisk();
}

module.exports = { loadOrCreateIdpCertificate };
