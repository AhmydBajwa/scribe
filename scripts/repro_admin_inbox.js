const { app } = require('../server');
const { createSession } = require('../src/auth/saml');
const { resetCasesForTests, logActivity } = require('../src/cases/cases');

async function run() {
  resetCasesForTests();

  // seed some admin activities
  logActivity(null, 'admin:login', 'Admin User', { source: 'test' });
  const created = logActivity('case-123', 'create', 'Admin User', { appointmentId: 'apt-1001', patientName: 'Test Patient' });
  logActivity('case-123', 'status:update', 'Admin User', { from: 'New', to: 'Voice Captured' });

  const server = app.listen(0);
  const port = server.address().port;
  const sessionId = createSession({ id: 'admin', name: 'Admin User', role: 'Clinic Administrator' });
  const cookie = `sessionId=${sessionId}`;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/admin/inbox?limit=20`, { headers: { Cookie: cookie } });
    const payload = await res.json();
    console.log('status', res.status);
    console.log('entries', Array.isArray(payload.entries) ? payload.entries.length : 'no entries');
    console.log(JSON.stringify(payload.entries, null, 2));
  } catch (err) {
    console.error('error', err);
  } finally {
    server.close();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
