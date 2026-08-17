function required(name, errors) {
  if (!String(process.env[name] || '').trim()) errors.push(name);
}

function validateProductionEnvironment() {
  if (process.env.NODE_ENV !== 'production') return;
  const errors = [];
  required('APP_BASE_URL', errors);
  required('SCRIBEL_USERS_JSON', errors);
  required('SAML_IDP_PRIVATE_KEY_B64', errors);
  required('SAML_IDP_CERT_B64', errors);
  required('SCRIBEL_DATA_DIR', errors);

  if (process.env.USE_MOCK_ATHENA !== 'true') {
    ['ATHENAHEALTH_BASE_URL', 'ATHENAHEALTH_CLIENT_ID', 'ATHENAHEALTH_CLIENT_SECRET', 'ATHENAHEALTH_SCOPE', 'ATHENAHEALTH_PRACTICE_ID'].forEach((name) => required(name, errors));
  }
  if (!['mock', 'local-mock'].includes(String(process.env.DIARIZATION_PROVIDER || 'pyannote').toLowerCase())) required('HF_TOKEN', errors);
  if (errors.length) throw new Error(`Production configuration is incomplete. Set these environment variables: ${errors.join(', ')}`);
  if (!/^https:\/\//i.test(process.env.APP_BASE_URL)) throw new Error('APP_BASE_URL must use https in production.');
}

module.exports = { validateProductionEnvironment };
