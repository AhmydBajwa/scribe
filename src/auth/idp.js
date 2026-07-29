const express = require('express');
const { initSamlEntities } = require('./samlEntities');
const { authenticate, listDemoUsers } = require('./users');

const router = express.Router();

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function renderLoginPage({ samlRequest, relayState, error }) {
  const demoUsersHtml = listDemoUsers()
    .map((user) => `<li><code>${escapeHtml(user.email)}</code> — ${escapeHtml(user.name)} (${escapeHtml(user.role)})</li>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Sign in — Northwind Health IdP</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f4f7fb; color: #14213d; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
      .card { background: white; border-radius: 12px; padding: 32px; box-shadow: 0 8px 24px rgba(0,0,0,0.08); width: 100%; max-width: 380px; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      p.sub { color: #64748b; font-size: 13px; margin: 0 0 20px; }
      label { display: block; font-size: 13px; font-weight: 600; margin: 14px 0 4px; }
      input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #cbd5e1; box-sizing: border-box; font: inherit; }
      button { width: 100%; margin-top: 18px; padding: 10px 12px; border-radius: 8px; border: none; background: #0f4c81; color: white; font-weight: 600; cursor: pointer; font: inherit; }
      button:hover { background: #123f6b; }
      .error { background: #fbe9e8; color: #b3261e; border-radius: 8px; padding: 10px 12px; font-size: 13px; margin-bottom: 12px; }
      .demo-users { margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
      .demo-users code { background: #eef2f6; padding: 1px 5px; border-radius: 4px; }
      .idp-badge { display: inline-block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #0f4c81; font-weight: 700; margin-bottom: 8px; }
    </style>
  </head>
  <body>
    <div class="card">
      <p class="idp-badge">Northwind Health Identity Provider</p>
      <h1>Sign in to continue</h1>
      <p class="sub">You're signing in to access the Athena Appointment Dashboard.</p>
      ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
      <form method="POST" action="/idp/sso">
        <input type="hidden" name="SAMLRequest" value="${escapeHtml(samlRequest)}" />
        <input type="hidden" name="RelayState" value="${escapeHtml(relayState)}" />
        <label for="email">Email</label>
        <input id="email" name="email" type="email" required autofocus />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" required />
        <button type="submit">Sign in</button>
      </form>
      <div class="demo-users">
        <strong>Demo accounts</strong>
        <ul>${demoUsersHtml}</ul>
      </div>
    </div>
  </body>
</html>`;
}

function renderAutoPostForm({ actionUrl, samlResponse, relayState }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="UTF-8" /><title>Signing you in…</title></head>
  <body onload="document.forms[0].submit()">
    <p>Signing you in…</p>
    <form method="POST" action="${escapeHtml(actionUrl)}">
      <input type="hidden" name="SAMLResponse" value="${escapeHtml(samlResponse)}" />
      <input type="hidden" name="RelayState" value="${escapeHtml(relayState)}" />
      <noscript><button type="submit">Continue</button></noscript>
    </form>
  </body>
</html>`;
}

router.get('/idp/sso', async (req, res) => {
  const { idp, sp } = await initSamlEntities(req);
  try {
    await idp.parseLoginRequest(sp, 'redirect', { query: req.query });
  } catch (error) {
    return res.status(400).send(`Invalid SAML AuthnRequest: ${escapeHtml(error.message)}`);
  }

  res.type('html').send(renderLoginPage({
    samlRequest: req.query.SAMLRequest,
    relayState: req.query.RelayState || '',
    error: null,
  }));
});

router.post('/idp/sso', async (req, res) => {
  const { idp, sp } = await initSamlEntities(req);
  const { email, password, SAMLRequest, RelayState } = req.body || {};

  let requestInfo;
  try {
    requestInfo = await idp.parseLoginRequest(sp, 'redirect', { query: { SAMLRequest, RelayState } });
  } catch (error) {
    return res.status(400).send(`Invalid SAML AuthnRequest: ${escapeHtml(error.message)}`);
  }

  const user = authenticate(email, password);
  if (!user) {
    return res.type('html').send(renderLoginPage({
      samlRequest: SAMLRequest,
      relayState: RelayState || '',
      error: 'Invalid email or password.',
    }));
  }

  const loginResponse = await idp.createLoginResponse(sp, requestInfo, 'post', { email: user.email });
  res.type('html').send(renderAutoPostForm({
    actionUrl: loginResponse.entityEndpoint,
    samlResponse: loginResponse.context,
    relayState: RelayState || '',
  }));
});

router.get('/idp/metadata', async (req, res) => {
  const { idp } = await initSamlEntities(req);
  res.type('application/xml').send(idp.getMetadata());
});

module.exports = router;
