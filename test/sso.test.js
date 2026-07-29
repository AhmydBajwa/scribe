const test = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('../server');

function extractHiddenValue(html, name) {
  const match = html.match(new RegExp(`name="${name}"\\s+value="([^"]*)"`));
  return match ? match[1] : null;
}

function extractCookie(response) {
  const setCookie = response.headers.get('set-cookie') || '';
  const match = setCookie.match(/sessionId=([^;]+)/);
  return match ? `sessionId=${match[1]}` : null;
}

// Walks the real SP-initiated SAML flow end to end: SP redirect -> IdP login
// page -> credential POST -> signed SAMLResponse -> SP validates and creates
// a session. No step is mocked; this exercises the actual samlify sign/verify
// path with the real self-signed certificate.
async function performRealSsoLogin(baseUrl, email, password) {
  const loginRes = await fetch(`${baseUrl}/auth/saml/login`, { redirect: 'manual' });
  assert.equal(loginRes.status, 302);
  const idpUrl = loginRes.headers.get('location');
  assert.match(idpUrl, /\/idp\/sso\?/);

  const idpLoginPageRes = await fetch(idpUrl);
  assert.equal(idpLoginPageRes.status, 200);
  const loginPageHtml = await idpLoginPageRes.text();
  const samlRequest = extractHiddenValue(loginPageHtml, 'SAMLRequest');
  const relayState = extractHiddenValue(loginPageHtml, 'RelayState') || '';
  assert.ok(samlRequest, 'login page should carry the original SAMLRequest');

  const credentialRes = await fetch(`${baseUrl}/idp/sso`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email, password, SAMLRequest: samlRequest, RelayState: relayState }),
  });
  assert.equal(credentialRes.status, 200);
  const autoPostHtml = await credentialRes.text();
  const samlResponse = extractHiddenValue(autoPostHtml, 'SAMLResponse');

  return { samlResponse, relayState, autoPostHtml };
}

test('GET /auth/saml/login redirects to the local IdP with a SAMLRequest', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/auth/saml/login`, { redirect: 'manual' });
    assert.equal(res.status, 302);
    const location = res.headers.get('location');
    assert.match(location, /\/idp\/sso\?/);
    assert.match(location, /SAMLRequest=/);
  } finally {
    server.close();
  }
});

test('GET /idp/sso renders a real login page carrying the original SAMLRequest', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    const loginRes = await fetch(`${baseUrl}/auth/saml/login`, { redirect: 'manual' });
    const idpUrl = loginRes.headers.get('location');
    const res = await fetch(idpUrl.startsWith('http') ? idpUrl : `${baseUrl}${idpUrl}`);
    const html = await res.text();
    assert.equal(res.status, 200);
    assert.match(html, /<form method="POST" action="\/idp\/sso">/);
    assert.match(html, /alex\.morgan@northwindhealth\.example/);
    assert.ok(extractHiddenValue(html, 'SAMLRequest'));
  } finally {
    server.close();
  }
});

test('POST /idp/sso rejects invalid credentials and re-renders the login page with an error', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    const loginRes = await fetch(`${baseUrl}/auth/saml/login`, { redirect: 'manual' });
    const idpUrl = loginRes.headers.get('location');
    const idpPageRes = await fetch(idpUrl);
    const html = await idpPageRes.text();
    const samlRequest = extractHiddenValue(html, 'SAMLRequest');

    const res = await fetch(`${baseUrl}/idp/sso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email: 'alex.morgan@northwindhealth.example', password: 'wrong-password', SAMLRequest: samlRequest, RelayState: '' }),
    });
    const resultHtml = await res.text();
    assert.equal(res.status, 200);
    assert.match(resultHtml, /Invalid email or password/);
    assert.equal(extractHiddenValue(resultHtml, 'SAMLResponse'), null);
  } finally {
    server.close();
  }
});

test('full SSO round trip: real signed SAMLResponse creates a session for the real user', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    const { samlResponse, relayState } = await performRealSsoLogin(baseUrl, 'alex.morgan@northwindhealth.example', 'CoordinatorPass!23');
    assert.ok(samlResponse, 'IdP should issue a signed SAMLResponse for correct credentials');

    const acsRes = await fetch(`${baseUrl}/auth/saml/acs`, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ SAMLResponse: samlResponse, RelayState: relayState }),
    });
    assert.equal(acsRes.status, 302);
    assert.equal(acsRes.headers.get('location'), '/');
    const cookieHeader = extractCookie(acsRes);
    assert.ok(cookieHeader, 'ACS should set a session cookie');

    const meRes = await fetch(`${baseUrl}/api/me`, { headers: { Cookie: cookieHeader } });
    const mePayload = await meRes.json();
    assert.equal(meRes.status, 200);
    assert.equal(mePayload.user.email, 'alex.morgan@northwindhealth.example');
    assert.equal(mePayload.user.name, 'Alex Morgan');
    assert.equal(mePayload.user.role, 'Care Coordinator');
    assert.equal(mePayload.user.organization, 'Northwind Health');
  } finally {
    server.close();
  }
});

test('a case created after real SSO login records the real signed-in user as createdBy', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const originalUseMock = process.env.USE_MOCK_ATHENA;
  process.env.USE_MOCK_ATHENA = 'true';
  try {
    const { samlResponse, relayState } = await performRealSsoLogin(baseUrl, 'jordan.riley@northwindhealth.example', 'AdminPass!23');
    const acsRes = await fetch(`${baseUrl}/auth/saml/acs`, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ SAMLResponse: samlResponse, RelayState: relayState }),
    });
    const cookieHeader = extractCookie(acsRes);

    await fetch(`${baseUrl}/api/dashboard`, { headers: { Cookie: cookieHeader } });

    const createRes = await fetch(`${baseUrl}/api/cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({ appointmentId: 'apt-1001' }),
    });
    const createPayload = await createRes.json();
    assert.equal(createRes.status, 201);
    assert.equal(createPayload.case.createdBy, 'Jordan Riley');
  } finally {
    server.close();
    process.env.USE_MOCK_ATHENA = originalUseMock;
  }
});

test('rejects an invalid/forged SAMLResponse at the ACS endpoint', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    const res = await fetch(`${baseUrl}/auth/saml/acs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ SAMLResponse: Buffer.from('<not>valid saml</not>').toString('base64'), RelayState: '' }),
    });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test('GET /auth/saml/metadata and /idp/metadata both return valid SAML metadata XML', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    const spMeta = await fetch(`${baseUrl}/auth/saml/metadata`);
    const spXml = await spMeta.text();
    assert.match(spXml, /<(\w+:)?EntityDescriptor/);
    assert.match(spXml, /SPSSODescriptor/);

    const idpMeta = await fetch(`${baseUrl}/idp/metadata`);
    const idpXml = await idpMeta.text();
    assert.match(idpXml, /<(\w+:)?EntityDescriptor/);
    assert.match(idpXml, /IDPSSODescriptor/);
  } finally {
    server.close();
  }
});
