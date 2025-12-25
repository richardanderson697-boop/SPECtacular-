# Eventid Integration Setup

## Overview

ASSURE CODE integrates with Eventid (your regulatory compliance event system) to:
- **Send events** about compliance checks, spec generation, and user actions
- **Receive webhooks** when regulatory changes affect your workspaces
- **Automate spec regeneration** when critical compliance changes occur

Your Eventid is running at: `https://v0-eventid-uuid-v7-eventversion-1-production.up.railway.app`

---

## Quick Setup (5 Steps)

### 1. Generate a Secure API Key

Run this in your terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
Copy the output - you'll use it in both systems.

### 2. Configure ASSURE CODE (Vercel)

Go to your Vercel project → Settings → Environment Variables and add:

| Variable | Value | Notes |
|----------|-------|-------|
| `EVENT_API_BASE_URL` | `https://v0-eventid-uuid-v7-eventversion-1-production.up.railway.app` | Your Eventid Railway URL |
| `EVENT_API_CLIENT_ID` | `assure-code-client` | OAuth client identifier |
| `EVENT_API_CLIENT_SECRET` | `<from Eventid>` | Get this from Step 3 |
| `ASSURE_CODE_API_KEY` | `<your generated key>` | The key from Step 1 |

### 3. Create OAuth Client in Eventid

You need to register ASSURE CODE in your Eventid system:

**Option A: Admin UI (if available)**
1. Navigate to your Eventid admin panel
2. Go to OAuth Clients or API Settings
3. Create new client:
   - **Client ID**: `assure-code-client`
   - **Name**: `ASSURE CODE Spec Generator`
   - **Grant Type**: `client_credentials`
   - **Scopes**: `events:write`
4. Copy the generated secret to Vercel (Step 2)

**Option B: Database Direct**

If Eventid doesn't have an admin UI yet, connect to your Railway PostgreSQL database and run:

```sql
-- First, hash your secret (replace 'your-secret-here' with a strong password)
-- Use bcrypt with cost factor 10

INSERT INTO oauth_clients (
  client_id,
  client_secret,
  client_name,
  grant_types,
  scopes,
  created_at
) VALUES (
  'assure-code-client',
  -- Use bcrypt to hash this secret before inserting
  'your-bcrypt-hashed-secret-here',
  'ASSURE CODE Spec Generator',
  ARRAY['client_credentials'],
  ARRAY['events:write'],
  NOW()
);
```

### 4. Configure Eventid (Railway)

In your Railway Eventid project → Variables tab, add:

| Variable | Value | Notes |
|----------|-------|-------|
| `ASSURE_CODE_API_URL` | `https://your-app.vercel.app` | Your ASSURE CODE deployment URL |
| `ASSURE_CODE_API_KEY` | `<your generated key>` | Same key from Step 1 |

### 5. Test the Connection

Run the test script locally:

```bash
# Set environment variables
export EVENT_API_BASE_URL="https://v0-eventid-uuid-v7-eventversion-1-production.up.railway.app"
export EVENT_API_CLIENT_ID="assure-code-client"
export EVENT_API_CLIENT_SECRET="your-secret-from-step-3"

# Run the test
npm run test:eventid
```

You should see:
```
✅ All tests passed! Eventid integration is working correctly.
```

---

## What Gets Logged

Once connected, ASSURE CODE automatically sends these events to Eventid:

### Compliance Events
- `compliance.check.completed` - When a user runs compliance analysis
- Includes frameworks detected (HIPAA, GDPR, PCI-DSS, etc.)
- Tracks violation severity

### Specification Events
- `specification.generated.success` - Successful spec generation
- `specification.generated.failure` - Failed spec generation

### Workspace Events
- `workspace.created` - New workspace created
- Includes workspace metadata

### Authentication Events
- `auth.signin` / `auth.signup` / `auth.signout`
- User activity tracking

---

## What You Receive

Eventid will send webhooks to ASSURE CODE when regulatory changes occur:

### HIGH/CRITICAL Alerts
- Triggers notifications in affected workspaces
- For CRITICAL events, marks specs for automatic regeneration
- Creates audit trail in compliance_notifications table

### Example Webhook
```json
{
  "event_id": "018f-xxxx-xxxx-xxxx-xxxx",
  "event_type": "REGULATORY_CHANGE",
  "framework": "HIPAA",
  "severity": "CRITICAL",
  "title": "HIPAA Breach Notification Rule Updated",
  "description": "New requirements for breach notification timelines",
  "jurisdiction": "US",
  "effective_date": "2025-01-01",
  "workspace_id": "optional-if-matched"
}
```

---

## Testing the Integration

### Test ASSURE CODE → Eventid
1. Create a new workspace in ASSURE CODE
2. Check Eventid logs in Railway
3. Verify event appears in Eventid Observability tab

### Test Eventid → ASSURE CODE

Test the webhook endpoint:
```bash
curl -X POST https://your-app.vercel.app/api/webhooks/eventid/test \
  -H "x-api-key: your-api-key"
```

Expected response:
```json
{
  "success": true,
  "message": "Webhook endpoint is configured correctly",
  "environment": {
    "hasEventApiUrl": true,
    "hasEventApiClientId": true,
    "hasEventApiClientSecret": true,
    "hasWebhookApiKey": true
  }
}
```

---

## Troubleshooting

### Events Not Reaching Eventid

1. **Check Vercel logs** for OAuth errors
2. **Verify credentials** match in both systems
3. **Test connectivity**: `curl https://v0-eventid-uuid-v7-eventversion-1-production.up.railway.app/health`
4. **Check Railway logs** for incoming requests

### Webhooks Not Being Received

1. **Verify API key** matches on both sides
2. **Check Vercel function logs** for incoming requests
3. **Test endpoint**: Use the `/api/webhooks/eventid/test` endpoint
4. **Ensure public access** - Vercel functions must be publicly accessible

### OAuth Token Failures

```
Error: OAuth token request failed: 401
```

**Solution**: 
- Verify CLIENT_ID and CLIENT_SECRET are correct
- Check if OAuth client exists in Eventid database
- Ensure secret is properly hashed with bcrypt

---

## Architecture Diagram

```
┌─────────────────┐                  ┌─────────────────┐
│  ASSURE CODE    │                  │    Eventid      │
│   (Vercel)      │                  │   (Railway)     │
└────────┬────────┘                  └────────┬────────┘
         │                                    │
         │  1. Request OAuth Token            │
         ├──────────────────────────────────>│
         │                                    │
         │  2. Return access_token            │
         │<──────────────────────────────────┤
         │                                    │
         │  3. Send Event with Bearer token   │
         ├──────────────────────────────────>│
         │                                    │
         │  4. Store & Monitor Events         │
         │                                    │
         │  5. Regulatory Change Detected     │
         │<──────────────────────────────────┤
         │     (Webhook with API Key)         │
         │                                    │
         │  6. Update Workspace & Notify      │
         │                                    │
```

---

## Next Steps

1. ✅ Set up environment variables in both systems
2. ✅ Create OAuth client in Eventid
3. ✅ Test connection with `npm run test:eventid`
4. ✅ Create a test workspace to verify event logging
5. ✅ Monitor Eventid Observability tab for incoming events
6. 📊 Set up custom monitoring dashboards
7. 🔔 Configure alert thresholds
8. 📝 Document your workspace matching rules

---

## Support

- **ASSURE CODE Issues**: Check Vercel function logs
- **Eventid Issues**: Check Railway logs under "Logs" tab
- **Integration Issues**: Test both directions independently
- **Database Issues**: Verify schema exists (run migration scripts)
