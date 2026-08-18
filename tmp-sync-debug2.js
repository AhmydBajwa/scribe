const { app } = require('./server');
const { URLSearchParams } = require('url');
(async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    const loginRes = await fetch(`${baseUrl}/auth/saml/login`, { redirect: 'manual' });
    console.log('login status', loginRes.status);
    const location = loginRes.headers.get('location');
    console.log('idp redirect', location && location.slice(0, 120));

    const idpRes = await fetch(location);
    const loginHtml = await idpRes.text();
    const samlRequest = loginHtml.match(/name="SAMLRequest"\s+value="([^"]*)"/)?.[1];
    const relayState = loginHtml.match(/name="RelayState"\s+value="([^"]*)"/)?.[1] || '';
    console.log('samlRequest present', !!samlRequest);

    const credRes = await fetch(`${baseUrl}/idp/sso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email: 'alex.morgan@northwindhealth.example', password: 'CoordinatorPass!23', SAMLRequest: samlRequest, RelayState: relayState }),
    });
    console.log('credential status', credRes.status);
    const autoPostHtml = await credRes.text();
    const samlResponse = autoPostHtml.match(/name="SAMLResponse"\s+value="([^"]*)"/)?.[1];
    console.log('samlResponse present', !!samlResponse);

    const acsRes = await fetch(`${baseUrl}/auth/saml/acs`, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ SAMLResponse: samlResponse, RelayState: relayState }),
    });
    console.log('acs status', acsRes.status, 'location', acsRes.headers.get('location'));

    const setCookie = acsRes.headers.get('set-cookie');
    console.log('set-cookie', !!setCookie);
    const cookieHeader = setCookie ? setCookie.split(';')[0] : null;

    const meRes = await fetch(`${baseUrl}/api/me`, { headers: { Cookie: cookieHeader } });
    console.log('me status', meRes.status);
    console.log('me payload', await meRes.text());

    const syncRes = await fetch(`${baseUrl}/api/appointments/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({}),
    });
    console.log('sync status', syncRes.status);
    const syncText = await syncRes.text();
    console.log('sync body length', syncText.length);
    console.log('sync body snippet', syncText.slice(0, 1000));
  } catch (error) {
    console.error('error', error.stack || error);
  } finally {
    server.close();
  }
})();
