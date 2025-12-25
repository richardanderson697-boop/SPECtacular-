# Quick Start: Eventid Connection

You have Eventid running at:
`https://v0-eventid-uuid-v7-eventversion-1-production.up.railway.app`

## Step 1: Add Environment Variables to Vercel

Go to your ASSURE CODE project settings in Vercel and add these 4 variables:

| Variable Name | Value |
|--------------|-------|
| `EVENT_API_BASE_URL` | `https://v0-eventid-uuid-v7-eventversion-1-production.up.railway.app` |
| `EVENT_API_CLIENT_ID` | `assure-code` |
| `EVENT_API_CLIENT_SECRET` | _(Get from Eventid OAuth client)_ |
| `ASSURE_CODE_API_KEY` | `ComplianceTag1050Handshake` |

## Step 2: Create OAuth Client in Eventid

You need to register ASSURE CODE as an OAuth client in your Eventid system.

**Option A: If Eventid has an Admin UI**
1. Log into Eventid at your Railway URL
2. Navigate to Settings → OAuth Clients
3. Create new client:
   - Name: `ASSURE CODE`
   - Client ID: `assure-code`
   - Generate a client secret and copy it
   - Add to Vercel as `EVENT_API_CLIENT_SECRET`

**Option B: Direct Database Insert**
If there's no UI, you can insert directly into PostgreSQL:

```sql
INSERT INTO oauth_clients (
  client_id,
  client_secret,
  name,
  redirect_uris,
  grant_types
) VALUES (
  'assure-code',
  'your-generated-secret-here',
  'ASSURE CODE Spec Generator',
  ARRAY['https://your-assure-code.vercel.app/api/auth/callback'],
  ARRAY['client_credentials']
);
```

## Step 3: Configure Eventid to Call ASSURE CODE

In Railway, add these environment variables to your Eventid project:

| Variable Name | Value |
|--------------|-------|
| `ASSURE_CODE_API_URL` | `https://your-assure-code-project.vercel.app` |
| `ASSURE_CODE_API_KEY` | `ComplianceTag1050Handshake` |

## Step 4: Test the Connection

Once configured, try creating a workspace in ASSURE CODE. Check the Eventid logs in Railway to see if events are being received.

You can also test the webhook by calling:
```bash
curl -X POST https://your-assure-code.vercel.app/api/webhooks/eventid/test \
  -H "x-api-key: ComplianceTag1050Handshake" \
  -H "Content-Type: application/json"
```

## What Happens Next

**When you create a workspace:**
- ASSURE CODE sends a `workspace.created` event to Eventid
- Eventid stores it in the audit trail with UUIDv7

**When you run compliance checks:**
- ASSURE CODE sends `compliance.check.completed` events to Eventid
- Eventid monitors for regulatory framework matches (HIPAA, GDPR, etc.)

**When Eventid detects regulatory changes:**
- Eventid calls ASSURE CODE's webhook
- ASSURE CODE creates notifications in affected workspaces
- For CRITICAL events, specs are automatically regenerated

## Troubleshooting

**Events not reaching Eventid?**
- Check Eventid logs in Railway under the "Logs" tab
- Verify `EVENT_API_BASE_URL` is correct and accessible
- Ensure OAuth client exists in Eventid database

**Webhook not working?**
- Test webhook endpoint is accessible: `curl https://your-assure-code.vercel.app/api/webhooks/eventid/test`
- Verify `ASSURE_CODE_API_KEY` matches in both systems
- Check Vercel function logs for errors

**Need help?**
Check the full setup guide in `EVENTID_SETUP.md`
