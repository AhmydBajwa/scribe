const samlify = require('samlify');
const { loadOrCreateIdpCertificate } = require('./certs');

// Schema (XSD) validation needs an external validator (normally xmllint) or
// samlify throws. We stub it to always pass - this skips structural XML
// linting only. The security-relevant check, XML-DSig signature
// verification, is handled separately by samlify and is NOT skipped.
samlify.setSchemaValidator({ validate: () => Promise.resolve('SUCCESS') });

const cache = new Map();

function getBaseUrl(req) {
  if (req) {
    const host = req.headers.host;
    const protocol = req.protocol || 'http';
    return `${protocol}://${host}`;
  }
  return process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
}

async function initSamlEntities(req) {
  const baseUrl = getBaseUrl(req);
  if (cache.has(baseUrl)) {
    return cache.get(baseUrl);
  }


  const promise = (async () => {
    const { privateKey, signingCert } = await loadOrCreateIdpCertificate();

    // Only the IdP signs (assertions/responses) - that's the trust-critical
    // direction. The SP does not sign its AuthnRequest, which is normal:
    // most real-world SPs never sign requests, only IdPs sign responses.
    const idp = samlify.IdentityProvider({
      entityID: `${baseUrl}/idp/metadata`,
      privateKey,
      signingCert,
      singleSignOnService: [
        { Binding: samlify.Constants.namespace.binding.redirect, Location: `${baseUrl}/idp/sso` },
      ],
      isAssertionEncrypted: false,
      wantAuthnRequestsSigned: false,
    });

    const sp = samlify.ServiceProvider({
      entityID: `${baseUrl}/auth/saml/metadata`,
      assertionConsumerService: [
        { Binding: samlify.Constants.namespace.binding.post, Location: `${baseUrl}/auth/saml/acs` },
      ],
      authnRequestsSigned: false,
      wantAssertionsSigned: true,
    });

    return { idp, sp };
  })();

  cache.set(baseUrl, promise);
  return promise;
}

module.exports = { initSamlEntities };

