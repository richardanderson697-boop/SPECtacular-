# Event API Integration Guide

## Overview

This application integrates with the Eventid UUIDv7 regulatory compliance event system to log all critical compliance and operational events for audit trails and monitoring.

## Architecture

The integration uses a server-to-server OAuth 2.0 client credentials flow to securely send events from the Swiftly Spec Generator to your Event API.

```
┌─────────────────────────┐         OAuth 2.0          ┌─────────────────────────┐
│                         │  ────────────────────────> │                         │
│  Swiftly Spec Generator │   Client Credentials       │   Event API             │
│  (Next.js App)          │  <────────────────────────  │   (Express/FastAPI)     │
│                         │         Bearer Token        │                         │
└─────────────────────────┘                             └─────────────────────────┘
         │                                                         │
         │                                                         │
         v                                                         v
   ┌─────────────┐                                         ┌──────────────┐
   │   Neon DB   │                                         │ PostgreSQL   │
   │  (Swiftly)  │                                         │ (Event Store)│
   └─────────────┘                                         └──────────────┘
```

## Setup Instructions

### 1. Configure Environment Variables

Add these environment variables to your Vercel project or `.env.local`:

```bash
# Event API Configuration
EVENT_API_BASE_URL=https://your-event-api-domain.com
EVENT_API_CLIENT_ID=your_client_id_here
EVENT_API_CLIENT_SECRET=your_client_secret_here
```

**Important:**
- `EVENT_API_BASE_URL`: The base URL where your Event API is hosted (local development or production)
- For local development: `http://localhost:3001` or `http://localhost:8000`
- For production: Your deployed Event API URL
- If not set, events will be logged to console but not sent to the API

### 2. Set Up OAuth 2.0 Client in Event API

In your Event API, create a new OAuth 2.0 client:

```sql
-- Example SQL for creating OAuth client
INSERT INTO oauth_clients (
  client_id,
  client_secret_hash,
  name,
  grant_types,
  created_at
) VALUES (
  'swiftly-spec-generator',
  -- bcrypt hash of your secret
  '$2b$10$...',
  'Swiftly Spec Generator',
  ARRAY['client_credentials'],
  NOW()
);
```

Or via your Event API admin interface/CLI.

### 3. Configure CORS (if running locally)

If your Event API is running locally and Swiftly is deployed on Vercel, you'll need to configure CORS:

```javascript
// In your Event API
app.use(cors({
  origin: [
    'https://your-vercel-deployment.vercel.app',
    'http://localhost:3000' // for local development
  ],
  credentials: true
}))
```

## Events Being Logged

The integration automatically logs these events:

### 1. Compliance Check Events
**Event Type:** `compliance.check.completed`
```json
{
  "eventType": "compliance.check.completed",
  "workspaceId": "uuid",
  "userId": "uuid",
  "timestamp": "2025-01-23T12:00:00Z",
  "source": "swiftly-spec-generator",
  "metadata": {
    "frameworks": ["GDPR", "PCI-DSS"],
    "severity": "minor-issues",
    "violationCount": 2,
    "hasBlockingViolations": false
  }
}
```

### 2. Specification Generation Events
**Event Type:** `specification.generated.success` or `specification.generated.failure`
```json
{
  "eventType": "specification.generated.success",
  "workspaceId": "uuid",
  "userId": "uuid",
  "timestamp": "2025-01-23T12:00:00Z",
  "source": "swiftly-spec-generator",
  "metadata": {
    "specificationId": "uuid"
  }
}
```

### 3. Workspace Events
**Event Type:** `workspace.created`
```json
{
  "eventType": "workspace.created",
  "workspaceId": "uuid",
  "userId": "uuid",
  "timestamp": "2025-01-23T12:00:00Z",
  "source": "swiftly-spec-generator",
  "metadata": {
    "workspaceName": "My Project"
  }
}
```

### 4. Authentication Events
**Event Type:** `auth.signin`, `auth.signup`, `auth.signout`
```json
{
  "eventType": "auth.signin",
  "workspaceId": "system",
  "userId": "uuid",
  "timestamp": "2025-01-23T12:00:00Z",
  "source": "swiftly-spec-generator",
  "metadata": {}
}
```

## Testing the Integration

### 1. Test OAuth Token Retrieval

```bash
curl -X POST https://your-event-api-domain.com/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "client_credentials",
    "client_id": "your_client_id",
    "client_secret": "your_client_secret"
  }'
```

Expected response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### 2. Test Event Submission

```bash
# First get token
TOKEN=$(curl -X POST https://your-event-api-domain.com/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "client_credentials",
    "client_id": "your_client_id",
    "client_secret": "your_client_secret"
  }' | jq -r '.access_token')

# Send test event
curl -X POST https://your-event-api-domain.com/api/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "eventType": "test.event",
    "workspaceId": "test-workspace",
    "userId": "test-user",
    "timestamp": "2025-01-23T12:00:00Z",
    "source": "swiftly-spec-generator",
    "metadata": {
      "test": true
    }
  }'
```

### 3. Monitor Logs

In your Swiftly application logs, you should see:
```
[v0] Event logged successfully: compliance.check.completed
```

If the Event API is not configured:
```
[v0] Event API not configured, skipping event logging
```

If there's an error:
```
[v0] Failed to log event: <error details>
```

## Deployment Options

### Option 1: Self-Hosted Event API
- Deploy your Event API to any server (AWS EC2, DigitalOcean, etc.)
- Use HTTPS with valid SSL certificate
- Set `EVENT_API_BASE_URL` to your domain

### Option 2: Local Development Tunnel
For testing, use ngrok or similar:
```bash
# In your Event API directory
ngrok http 3001

# Use the ngrok URL as EVENT_API_BASE_URL
EVENT_API_BASE_URL=https://abc123.ngrok.io
```

### Option 3: Docker Compose (Recommended for Development)
```yaml
version: '3.8'
services:
  event-api:
    build: ./event-api
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/events
      
  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=events
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
```

## Security Considerations

1. **Never commit secrets:** Use environment variables for all sensitive data
2. **Use HTTPS:** Always use HTTPS in production for the Event API
3. **Rotate credentials:** Regularly rotate OAuth client secrets
4. **Monitor logs:** Watch for failed authentication attempts
5. **Rate limiting:** Implement rate limiting on the Event API
6. **Token caching:** The client caches tokens to reduce OAuth requests

## Troubleshooting

### Events not appearing in Event API

1. Check environment variables are set:
```bash
# In Vercel dashboard or locally
echo $EVENT_API_BASE_URL
echo $EVENT_API_CLIENT_ID
```

2. Check Event API is reachable:
```bash
curl https://your-event-api-domain.com/health
```

3. Verify OAuth credentials:
```bash
curl -X POST https://your-event-api-domain.com/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "client_credentials",
    "client_id": "your_client_id",
    "client_secret": "your_client_secret"
  }'
```

4. Check Vercel logs for error messages:
```bash
vercel logs
```

### OAuth token errors

**Error:** "OAuth token request failed"
- Verify `EVENT_API_CLIENT_ID` and `EVENT_API_CLIENT_SECRET` are correct
- Ensure Event API OAuth endpoint is working
- Check network connectivity

**Error:** "Event API request failed: 401"
- Token may be expired (unlikely with 1-minute buffer)
- OAuth client may have been revoked
- Check Event API logs for authentication errors

### CORS errors (in browser)

If you see CORS errors in browser console:
- Event logging happens server-side, not in browser
- CORS should not affect this integration
- If you see CORS errors, they're likely from other API calls

## Event Retention and Compliance

The Event API stores all events with UUIDv7 timestamps for:
- Audit trails required by GRC frameworks
- Compliance reporting (SOC2, ISO 27001, etc.)
- Incident investigation
- User activity monitoring

Recommended retention policies:
- Authentication events: 90 days minimum
- Compliance events: 7 years (varies by regulation)
- Specification events: 3 years
- Workspace events: Indefinitely

## Next Steps

1. Set up your Event API OAuth client
2. Configure environment variables in Vercel
3. Test the integration with a compliance check
4. Monitor events in your Event API dashboard
5. Set up alerts for critical events (failed compliance checks, etc.)

## Support

For issues with:
- **Swiftly integration:** Check this documentation and application logs
- **Event API:** Refer to the Event API documentation
- **OAuth flow:** Review OAuth 2.0 client credentials flow documentation
