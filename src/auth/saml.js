const crypto = require('crypto');
const { initSamlEntities } = require('./samlEntities');
const { getPublicUserByEmail } = require('./users');

const sessions = new Map();

function createSession(user) {
  const sessionId = crypto.randomBytes(16).toString('hex');
  sessions.set(sessionId, { user, createdAt: Date.now() });
  return sessionId;
}

function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

// SP-initiated login: build an AuthnRequest and redirect the browser to the
// local IdP. This is a real browser navigation, not a fetch/AJAX call -
// SAML's redirect binding requires the user-agent to actually go there.
async function initiateSAMLLogin(req, res) {
  const { idp, sp } = await initSamlEntities(req);
  const loginRequest = sp.createLoginRequest(idp, 'redirect');
  res.redirect(loginRequest.context);
}

// ACS: the IdP's auto-submitting form POSTs the signed SAMLResponse here.
// samlify validates the XML-DSig signature, audience, and expiry before
// extract.nameID is trusted.
async function handleSAMLACS(req, res) {
  const { idp, sp } = await initSamlEntities(req);

  try {
    const { extract } = await sp.parseLoginResponse(idp, 'post', { body: req.body });
    const user = getPublicUserByEmail(extract.nameID);
    if (!user) {
      return res.status(401).send('SSO sign-in succeeded, but no local account matches this identity.');
    }

    const sessionId = createSession(user);
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      sameSite: 'lax',
    });
    res.redirect('/');
  } catch (error) {
    res.status(401).send(`SSO sign-in failed: ${error.message}`);
  }
}

async function getSAMLMetadata(req, res) {
  const { sp } = await initSamlEntities(req);
  res.type('application/xml').send(sp.getMetadata());
}

function requireAuth(req, res, next) {
  const sessionId = req.cookies?.sessionId;
  if (!sessionId) {
    return res.status(401).json({ ok: false, message: 'Authentication required. Sign in first.' });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(401).json({ ok: false, message: 'Session expired or invalid. Please sign in again.' });
  }

  req.user = session.user;
  next();
}

module.exports = {
  createSession,
  getSession,
  initiateSAMLLogin,
  handleSAMLACS,
  getSAMLMetadata,
  requireAuth,
};
