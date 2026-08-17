const selfsigned = require('selfsigned');

(async () => {
  const pems = await selfsigned.generate(
    [{ name: 'commonName', value: process.env.SAML_COMMON_NAME || 'scribel-render-idp' }],
    { days: 3650, keySize: 2048 }
  );
  console.log(`SAML_IDP_PRIVATE_KEY_B64=${Buffer.from(pems.private, 'utf8').toString('base64')}`);
  console.log(`SAML_IDP_CERT_B64=${Buffer.from(pems.cert, 'utf8').toString('base64')}`);
})();
