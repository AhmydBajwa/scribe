const { app } = require('../server');
const { createSession } = require('../src/auth/saml');
const { resetCasesForTests, logActivity } = require('../src/cases/cases');

(async function run() {
  resetCasesForTests();

  // seed activity
  logActivity(null, 'admin:login', 'UI Admin', { source: 'test' });
  logActivity('case-ui-1', 'create', 'UI Admin', { appointmentId: 'apt-1001', patientName: 'UI Patient' });

  const server = app.listen(0);
  const port = server.address().port;
  const sessionId = createSession({ id: 'ui-admin', name: 'UI Admin', role: 'Clinic Administrator' });
  const cookie = `sessionId=${sessionId}`;

  const res = await fetch(`http://127.0.0.1:${port}/api/admin/inbox?limit=20`, { headers: { Cookie: cookie } });
  const payload = await res.json();
  console.log('HTTP status', res.status);
  console.log('entries', payload.entries.length);
  console.log(payload.entries.map(e => ({ action: e.action, actor: e.actor, case: e.case && e.case.id })));

  server.close();
})();
