# Eventid Integration Setup Guide

## Quick Setup

Your Eventid is running at: `https://v0-eventid-uuid-v7-eventversion-1-production.up.railway.app`

### Step 1: Configure ASSURE CODE Environment Variables

Add these to your Vercel project (Settings → Environment Variables):

```bash
# Eventid Connection (ASSURE CODE → Eventid)
EVENT_API_BASE_URL=https://v0-eventid-uuid-v7-eventversion-1-production.up.railway.app
EVENT_API_CLIENT_ID=assure-code-client
EVENT_API_CLIENT_SECRET=your-oauth-secret-from-eventid

# Webhook Security (Eventid → ASSURE CODE)
ASSURE_CODE_API_KEY=<generate-secure-key>
```

**Generate a secure API key:**
```bash
# Run this in your terminal to generate a secure key:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Step 2: Configure Eventid Environment Variables

In your Railway project for Eventid, add/update these environment variables:

```bash
# ASSURE CODE Webhook Configuration
ASSURE_CODE_API_URL=https://your-assure-code-app.vercel.app
ASSURE_CODE_API_KEY=<same-key-as-above>
```

### Step 3: Create OAuth Client in Eventid

You need to register ASSURE CODE as an OAuth client in Eventid:

**Option A: If Eventid has an Admin UI**
1. Go to https://v0-eventid-uuid-v7-eventversion-1-production.up.railway.app/admin
2. Navigate to OAuth Clients or Settings
3. Create new client:
   - Client ID: `assure-code-client`
   - Client Name: `ASSURE CODE Spec Generator`
   - Grant Type: `client_credentials`
   - Scopes: `events:write`

**Option B: If using PostgreSQL directly**

Run this SQL in your Eventid database:

```sql
INSERT INTO oauth_clients (
  client_id,
  client_secret,
  client_name,
  grant_types,
  scopes,
  created_at
) VALUES (
  'assure-code-client',
  -- Hash this secret with bcrypt before storing!
  '$2b$10$yourHashedSecretHere',
  'ASSURE CODE Spec Generator',
  ARRAY['client_credentials'],
  ARRAY['events:write'],
  NOW()
);
```

### Step 4: Test the Connection

Once configured, test the integration:

1. **Test ASSURE CODE → Eventid:**
   - Create a new workspace in ASSURE CODE
   - Check Eventid logs for incoming events
   - Navigate to Eventid Observability tab to see events

2. **Test Eventid → ASSURE CODE:**
   - Use the test endpoint: `curl -X POST https://your-assure-code-app.vercel.app/api/webhooks/eventid/test -H "x-api-key: your-api-key"`
   - Check ASSURE CODE logs for webhook receipt

## Troubleshooting

### Connection Issues

If events aren't flowing to Eventid:
1. Check Railway logs for Eventid
2. Verify EVENT_API_BASE_URL includes `https://`
3. Confirm OAuth client credentials match
4. Check ASSURE CODE API logs for error messages

### Webhook Issues

If ASSURE CODE isn't receiving webhooks:
1. Verify ASSURE_CODE_API_KEY matches on both sides
2. Check Vercel function logs
3. Ensure webhook URL is publicly accessible
4. Test with the `/test` endpoint first

## Event Flow

```
User creates workspace in ASSURE CODE
  ↓
ASSURE CODE sends event to Eventid
  ↓
Eventid stores event with UUIDv7 timestamp
  ↓
Eventid monitors for regulatory changes
  ↓
If HIGH/CRITICAL match detected
  ↓
Eventid calls ASSURE CODE webhook
  ↓
ASSURE CODE creates notification/regenerates spec
```

## Next Steps

1. Set up monitoring dashboards
2. Configure alert thresholds
3. Review compliance event types
4. Customize workspace matching rules
