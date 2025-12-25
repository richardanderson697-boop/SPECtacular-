# Eventid Integration Guide

## Architecture Overview

ASSURE-CODE integrates with Eventid for regulatory compliance monitoring with **bidirectional communication**:

### 1. ASSURE-CODE → Eventid (Event Submission)
When users generate specs, check compliance, or perform key actions, ASSURE-CODE sends events to Eventid's OAuth 2.0 secured API.

**Events sent:**
- `COMPLIANCE_CHECK_COMPLETED` - When RAG compliance analysis finishes
- `SPECIFICATION_GENERATED` - When AI specs are created
- `WORKSPACE_CREATED` - When new workspace is initialized
- `USER_AUTHENTICATED` - User login events

### 2. Eventid → ASSURE-CODE (Webhook Callbacks)
When Eventid detects HIGH/CRITICAL regulatory changes (new HIPAA rules, GDPR updates, etc.), it triggers ASSURE-CODE's webhook to notify affected workspaces.

**Webhook endpoint:** `POST /api/webhooks/eventid`

**Actions triggered:**
- **CRITICAL severity:** Marks workspace for spec regeneration + creates GitHub PR
- **HIGH severity:** Creates notification for manual review
- **MEDIUM/LOW severity:** Logs for awareness

---

## Configuration

### Step 1: Configure ASSURE-CODE → Eventid

Add these environment variables to send events TO Eventid:

```bash
# Eventid API endpoint
EVENT_API_BASE_URL=https://eventid-api.yourdomain.com

# OAuth 2.0 credentials (get from Eventid admin panel)
EVENT_API_CLIENT_ID=assure-code-client-id
EVENT_API_CLIENT_SECRET=your-secret-from-eventid
```

### Step 2: Configure Eventid → ASSURE-CODE

In your Eventid `.env`, add ASSURE-CODE's webhook URL and API key:

```bash
# ASSURE-CODE webhook endpoint
ASSURE_CODE_API_URL=https://assure-code.yourdomain.com/api/webhooks/eventid

# API key for Eventid to authenticate with ASSURE-CODE
ASSURE_CODE_API_KEY=your_secure_random_key_here
```

**Generate a secure API key:**
```bash
openssl rand -hex 32
```

Add the same key to ASSURE-CODE's environment variables:
```bash
ASSURE_CODE_API_KEY=your_secure_random_key_here
```

### Step 3: Run Database Migrations

```bash
# Create regulatory events tables
psql $DATABASE_URL < scripts/007_regulatory_events_tables.sql
```

---

## Testing the Integration

### Test 1: ASSURE-CODE → Eventid
Generate a specification and check Eventid logs for the incoming event.

### Test 2: Eventid → ASSURE-CODE
Send a test webhook to ASSURE-CODE:

```bash
curl -X POST https://assure-code.yourdomain.com/api/webhooks/eventid \
  -H "Authorization: Bearer your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "01234567-89ab-cdef-0123-456789abcdef",
    "event_type": "REGULATORY_CHANGE",
    "framework": "HIPAA",
    "severity": "HIGH",
    "jurisdiction": "US",
    "title": "New HIPAA encryption requirements",
    "description": "Updated security standards require AES-256 for PHI at rest",
    "source_url": "https://hhs.gov/hipaa/updates/...",
    "effective_date": "2025-01-01",
    "created_at": "2024-12-23T15:00:00Z"
  }'
```

Expected response:
```json
{
  "success": true,
  "event_id": "01234567-89ab-cdef-0123-456789abcdef",
  "processed": true
}
```

---

## Monitoring

Both systems log integration events:

**ASSURE-CODE logs:**
```
[v0] Sending event to Eventid: SPECIFICATION_GENERATED
[v0] Event sent successfully: {...}
[v0] Eventid webhook received
[v0] Processing event: {id, type, framework, severity}
```

**Prometheus metrics** (if configured):
- `eventid_events_sent_total`
- `eventid_webhooks_received_total`
- `eventid_notifications_created_total`

---

## Security Notes

1. **OAuth 2.0:** ASSURE-CODE uses client credentials flow (M2M auth) to send events
2. **API Key:** Eventid uses Bearer token authentication for webhooks
3. **HTTPS Required:** Both endpoints must use TLS in production
4. **Rate Limiting:** Recommended for webhook endpoint to prevent abuse

---

## Workspace Notifications

Users see regulatory notifications in their workspace dashboard. To fetch notifications:

```bash
GET /api/workspaces/{workspaceId}/notifications
Authorization: Bearer <user_token>
```

Response:
```json
{
  "notifications": [
    {
      "id": "uuid",
      "framework": "HIPAA",
      "severity": "HIGH",
      "title": "New HIPAA encryption requirements",
      "description": "...",
      "action_required": true,
      "viewed": false,
      "created_at": "2024-12-23T15:00:00Z"
    }
  ]
}
