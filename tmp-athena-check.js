const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

async function main() {
  const baseUrl = (process.env.ATHENAHEALTH_BASE_URL || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const clientId = process.env.ATHENAHEALTH_CLIENT_ID;
  const clientSecret = process.env.ATHENAHEALTH_CLIENT_SECRET;
  const scope = process.env.ATHENAHEALTH_SCOPE;

  if (!baseUrl || !clientId || !clientSecret) {
    console.error('Missing Athena credentials in .env');
    process.exit(1);
  }

  const tokenUrl = `https://${baseUrl}/oauth/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope,
  });

  console.log('Requesting token from', tokenUrl);
  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  });

  const tokenText = await tokenResponse.text();
  console.log('Token status:', tokenResponse.status);
  console.log('Token body:', tokenText);

  if (!tokenResponse.ok) {
    process.exit(1);
  }

  let tokenPayload;
  try {
    tokenPayload = JSON.parse(tokenText);
  } catch (error) {
    console.error('Unable to parse token JSON', error);
    process.exit(1);
  }

  const accessToken = tokenPayload.access_token;
  if (!accessToken) {
    console.error('No access token returned');
    process.exit(1);
  }

  const practiceId = process.env.ATHENAHEALTH_PRACTICE_ID;
  const appointmentsPath = process.env.ATHENAHEALTH_APPOINTMENTS_PATH || '/appointments';
  const appointmentsUrl = new URL(`https://${baseUrl}${appointmentsPath}`);
  if (practiceId) {
    appointmentsUrl.searchParams.set('practiceid', practiceId);
  }

  console.log('Requesting appointments from', appointmentsUrl.toString());
  const apptResponse = await fetch(appointmentsUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  const apptText = await apptResponse.text();
  console.log('Appointments status:', apptResponse.status);
  console.log('Appointments body:', apptText);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
