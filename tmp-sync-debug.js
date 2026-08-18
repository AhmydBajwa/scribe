const { app } = require('./server');
const http = require('http');
const { URLSearchParams } = require('url');

async function main() {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const loginRes = await fetch(`${baseUrl}/auth/saml/login`, { redirect: 'manual' });
    console.log('login status', loginRes.status);
    const location = loginRes.headers.get('location');
    console.log('redirect to', location);
    const idpUrl = location.startsWith('http') ? location : `${baseUrl}${location}`;

    const idpPageRes = await fetch(idpUrl);
    const html = await idpPageRes.text();
    const samlRequestMatch = html.match(/name="SAMLRequest"\s+value="([^"]*)"/);
    const relayStateMatch = html.match(/name="RelayState"\s+value="([^"]*)"/);
    const samlRequest = samlRequestMatch ? samlRequestMatch[1] : null;
    const relayState = relayStateMatch ? relayStateMatch[1] : '';
    console.log('got samlRequest', !!samlRequest);

    const credentialRes = await fetch(`${baseUrl}/idp/sso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email: 'alex.morgan@northwindhealth.example', password: 'CoordinatorPass!23', SAMLRequest: samlRequest, RelayState: relayState }),
    });
    const autoPostHtml = await credentialRes.text();
    const samlResponseMatch = autoPostHtml.match(/name="SAMLResponse"\s+value="([^"]*)"/);
    const samlResponse = samlResponseMatch ? samlResponseMatch[1] : null;
    console.log('got samlResponse', !!samlResponse);

    const acsRes = await fetch(`${baseUrl}/auth/saml/acs`, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ SAMLResponse: samlResponse, RelayState: relayState }),
    });
    console.log('acs status', acsRes.status, 'location', acsRes.headers.get('location'));
    const cookie = acsRes.headers.get('set-cookie');
    console.log('cookie', cookie);
    const cookieHeader = cookie ? cookie.split(';')[0] : null;

    const syncRes = await fetch(`${baseUrl}/api/appointments/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({}),
    });
    console.log('sync status', syncRes.status);
    const syncBody = await syncRes.text();
    console.log('sync body', syncBody);
  } catch (error) {
    console.error(error);
  } finally {
    server.close();
  }
}

main();
