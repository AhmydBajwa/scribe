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
      /* Scribel sign-in theme */
      :root { --ink: #24332d; --muted: #68726b; --forest: #315f4d; --forest-deep: #234a3b; --cream: #f5f2eb; --line: #ded6c8; --soft: #f5f1e8; }
      * { box-sizing: border-box; }
      body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; background: radial-gradient(circle at top left, rgba(91, 137, 105, .15), transparent 31%), linear-gradient(180deg, #fbfaf6, var(--cream)); color: var(--ink); padding: 24px; display: grid; place-items: center; }
      .shell { width: 100%; max-width: 940px; display: grid; grid-template-columns: minmax(280px, .88fr) minmax(360px, 1fr); overflow: hidden; border: 1px solid rgba(204, 193, 177, .8); border-radius: 22px; background: #fffefb; box-shadow: 0 24px 60px rgba(50, 56, 44, .14); }
      .welcome { color: white; padding: 48px; display: flex; flex-direction: column; justify-content: space-between; min-height: 580px; background: linear-gradient(145deg, #274c3d, #315f4d 58%, #587d55); }
      .wordmark { margin: 0; font: 700 32px/1 Georgia, "Times New Roman", serif; letter-spacing: -.05em; }
      .wordmark::before { content: ''; display: inline-block; width: 13px; height: 13px; margin: 0 9px 2px 0; border-radius: 50% 50% 50% 2px; background: #b9dfaa; transform: rotate(-35deg); }
      .welcome-copy h2 { margin: 0 0 12px; max-width: 10ch; font: 700 38px/1.04 Georgia, "Times New Roman", serif; letter-spacing: -.045em; }
      .welcome-copy p { margin: 0; color: rgba(255,255,255,.82); max-width: 32ch; font-size: 15px; line-height: 1.65; }
      .security-note { display: flex; align-items: center; gap: 8px; color: rgba(255,255,255,.78); font-size: 12px; }
      .security-note::before { content: '✓'; display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: rgba(185, 223, 170, .18); color: #d4efc8; font-weight: 800; }
      .card { width: auto; max-width: none; border-radius: 0; padding: 48px; box-shadow: none; align-self: center; }
      .idp-badge { display: inline-flex; align-items: center; gap: 7px; margin: 0 0 14px; color: var(--forest); }
      .idp-badge::before { content: ''; width: 18px; height: 1px; background: currentColor; opacity: .65; }
      h1 { margin: 0 0 7px; font: 700 30px/1.08 Georgia, "Times New Roman", serif; letter-spacing: -.04em; }
      p.sub { color: var(--muted); font-size: 14px; line-height: 1.55; margin: 0 0 26px; }
      label { font-size: 12px; font-weight: 750; color: var(--muted); margin: 16px 0 6px; }
      input { padding: 12px 13px; border-radius: 10px; border-color: var(--line); color: var(--ink); }
      input:focus { outline: none; border-color: #719582; box-shadow: 0 0 0 3px rgba(113, 149, 130, .16); }
      button { margin-top: 22px; padding: 12px 14px; border-radius: 10px; background: var(--forest); font-weight: 700; box-shadow: 0 5px 12px rgba(49, 95, 77, .18); }
      button:hover { background: var(--forest-deep); transform: translateY(-1px); }
      .error { background: #feecea; color: #9b2d23; border: 1px solid #f2c9c3; border-radius: 10px; padding: 11px 12px; }
      .demo-users { margin-top: 28px; padding: 18px; border: 1px solid var(--line); border-radius: 12px; background: var(--soft); }
      .demo-users strong { color: var(--ink); font-size: 13px; }
      .demo-users ul { display: grid; gap: 9px; margin: 12px 0 0; padding: 0; list-style: none; }
      .demo-users li { display: grid; gap: 2px; }
      .demo-users code { width: fit-content; background: #fffdf8; color: var(--forest-deep); padding: 2px 5px; border: 1px solid rgba(204, 193, 177, .75); border-radius: 5px; }
      @media (max-width: 720px) { body { padding: 14px; } .shell { grid-template-columns: 1fr; } .welcome { min-height: 270px; padding: 32px; } .welcome-copy { margin: 42px 0; } .welcome-copy h2 { font-size: 32px; } .card { padding: 32px 26px; } }
    </style>
    <script>document.title = 'Sign in | Scribel';</script>
  </head>
  <body>
    <main class="shell">
      <aside class="welcome">
        <p class="wordmark">Scribel</p>
        <div class="welcome-copy"><h2>Clear care starts here.</h2><p>Your secure workspace for appointments, case work, and the details that move care forward.</p></div>
        <div class="security-note">Secure sign-in via Northwind Health</div>
      </aside>
      <div class="card">
      <p class="idp-badge">Secure access</p>
      <h1>Welcome back</h1>
      <p class="sub">Sign in to continue to your Scribel workspace.</p>
      ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
      <form method="POST" action="/idp/sso">
        <input type="hidden" name="SAMLRequest" value="${escapeHtml(samlRequest)}" />
        <input type="hidden" name="RelayState" value="${escapeHtml(relayState)}" />
        <label for="email">Work email</label>
        <input id="email" name="email" type="email" autocomplete="email" required autofocus />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required />
        <button type="submit">Sign in to Scribel</button>
      </form>
      <div class="demo-users">
        <strong>Demo accounts</strong>
        <ul>${demoUsersHtml}</ul>
      </div>
      </div>
    </main>
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
