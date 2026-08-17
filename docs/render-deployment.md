# Deploy Scribel on Render

Scribel uses a Docker service because local Whisper and pyannote run in Python on the server. A Render Starter-or-higher web service and persistent disk are required: the disk stores uploaded audio, case data, sessions, and downloaded local model files.

## 1. Prepare the repository

- Commit `Dockerfile`, `requirements.txt`, `render.yaml`, and the application changes.
- Never commit `.env`, `data/`, audio files, certificates, or tokens.
- Rotate the Athena secret and Hugging Face token that were previously present in local Git history.

## 2. Generate SAML credentials locally

Run this only on your machine:

```powershell
node scripts/generate_saml_env.js
```

Copy the two printed values into Render. Keep them secret and stable; replacing them invalidates the SAML trust relationship.

## 3. Create the Render Blueprint

In Render, choose **New → Blueprint** and select this repository. The included `render.yaml` creates the Docker web service and mounts `/var/data` as persistent storage.

When Render prompts for `sync: false` variables, set these values:

```text
APP_BASE_URL=https://your-service-name.onrender.com
ATHENAHEALTH_BASE_URL=your Athena base URL
ATHENAHEALTH_CLIENT_ID=your Athena client ID
ATHENAHEALTH_CLIENT_SECRET=your Athena client secret
ATHENAHEALTH_SCOPE=your Athena scope
ATHENAHEALTH_PRACTICE_ID=your Athena practice ID
HF_TOKEN=your Hugging Face read token
SAML_IDP_PRIVATE_KEY_B64=value generated in step 2
SAML_IDP_CERT_B64=value generated in step 2
SCRIBEL_USERS_JSON=[{"email":"provider@example.com","password":"use-a-long-unique-password","name":"Provider Name","role":"Care Coordinator","organization":"Scribel"}]
```

`SCRIBEL_USERS_JSON` can contain multiple users. It is a secret environment variable, not a source-controlled file. For production, use unique long passwords or password hashes; do not use the local demo credentials.

## 4. Verify after deployment

- Open `https://your-service-name.onrender.com/health` and expect `{ "ok": true }`.
- Visit `/auth/saml/metadata` and `/idp/metadata`; register the current metadata with the expected SAML side.
- Sign in with a configured environment-managed user.
- Upload a short audio sample and check that Whisper, diarization, transcript review, and retry handling work.

## Important operational limits

- CPU Whisper `small` plus pyannote diarization is resource intensive. Expect long processing times for 20-minute files; a paid service with adequate memory is required.
- Render's persistent disk keeps data for one service instance. For multi-instance or production healthcare use, move case data/sessions to managed databases and audio to encrypted object storage.
- Render environment variables are the source of truth in production. The server refuses to start if required production credentials are missing.
