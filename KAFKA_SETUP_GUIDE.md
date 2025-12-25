# Kafka Bidirectional Integration Setup Guide

This guide explains how to set up bidirectional communication between ASSURE-CODE and the Kafka platform.

## Overview

ASSURE-CODE uses Kafka for bidirectional communication with Eventid and GitHub Actions:

**INBOUND:** Eventid → Kafka → ASSURE-CODE (regulatory changes)
**OUTBOUND:** ASSURE-CODE → Kafka → GitHub Actions (spec updates for PRs)

## Kafka Endpoints

- **Kafka Broker (Real):** `switchback.proxy.rlwy.net:58989` - Message broker for sending/receiving
- **Kafka UI (Monitoring):** `kafka-ui-production-b581.up.railway.app` - Web dashboard (read-only)

## Environment Variables Setup

### ASSURE-CODE Side (Your Configuration)

Add these environment variables to your Vercel project:

```bash
# Required for database operations
DATABASE_URL=your_neon_database_url

# Required for Kafka broker connection
KAFKA_BROKER_URL=switchback.proxy.rlwy.net:58989

# Optional: If Kafka broker requires authentication
KAFKA_SASL_USERNAME=your_username
KAFKA_SASL_PASSWORD=your_password

# Optional: For webhook security in production
WEBHOOK_API_KEY=your_secret_key

# Public app URL for webhook callbacks
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

## Kafka Platform Side (Eventid/DevOps Configuration)

### 1. Create Kafka Topics

You need two topics in your Kafka broker:

```bash
# Topic for ASSURE-CODE to send spec updates (outbound)
Topic: assure-code-spec-updates
Partitions: 3 (recommended)
Replication Factor: 2 (for reliability)

# Topic for regulatory events from Eventid (inbound)
Topic: regulatory-events
Partitions: 3 (recommended)
Replication Factor: 2 (for reliability)
```

### 2. Configure Eventid Platform

Eventid needs to send webhooks to ASSURE-CODE when regulatory changes are detected:

**Webhook URL:** `https://your-domain.vercel.app/api/webhooks/eventid`

**HTTP Method:** `POST`

**Content-Type:** `application/json`

**Payload Format:**
```json
{
  "event_id": "evt_123456",
  "event_type": "REGULATORY_CHANGE",
  "framework": "PCI-DSS",
  "title": "Updated encryption requirements",
  "description": "New requirements for payment data encryption...",
  "effective_date": "2024-06-01",
  "severity": "high",
  "affected_requirements": ["Req 3.4", "Req 3.5"]
}
```

### 3. Configure GitHub Actions Consumer

Set up a GitHub Actions workflow to consume messages from the `assure-code-spec-updates` topic:

```yaml
name: Process ASSURE-CODE Updates
on:
  workflow_dispatch:
  schedule:
    - cron: '*/5 * * * *'  # Check every 5 minutes

jobs:
  consume-updates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Consume Kafka Messages
        run: |
          # Use a Kafka consumer to read from assure-code-spec-updates
          # Parse the message and create a PR with updated specs
          
      - name: Create Pull Request
        uses: peter-evans/create-pull-request@v5
        with:
          title: '[COMPLIANCE] Updated specifications'
          body: 'Automated compliance update from ASSURE-CODE'
          branch: compliance-update-${{ github.run_id }}
```

## Testing the Integration

### Quick Test (UI)

Navigate to `/admin/kafka-test` in your deployed app and click:

1. **"Create Missing Tables"** - Sets up database tables
2. **"Test Real Kafka Broker"** - Tests actual Kafka connection
3. **"Diagnose Real Connection"** - Shows what's configured on both sides

### What Each Test Does

#### Test Real Kafka Broker
- **REAL:** Connects to actual Kafka broker at switchback.proxy.rlwy.net:58989
- **REAL:** Sends test message to `assure-code-spec-updates` topic
- **REAL:** Verifies broker connectivity and authentication

#### Diagnose Real Connection
- Shows configuration status on ASSURE-CODE side
- Shows what needs to be configured on Kafka platform side
- Lists what's real vs simulated

## Data Flow

### Inbound Flow (Receiving Regulatory Changes)

```
Eventid Platform
    ↓ (detects regulatory change)
Kafka Topic: regulatory-events
    ↓ (publishes event)
ASSURE-CODE Webhook: /api/webhooks/eventid
    ↓ (receives HTTP POST)
Database: regulatory_events table
    ↓ (analyzes impact)
Affected Workspaces
    ↓ (generates updated specs)
Outbound Flow →
```

### Outbound Flow (Sending Spec Updates)

```
ASSURE-CODE
    ↓ (creates updated spec)
Kafka Producer: lib/kafka-client.ts
    ↓ (sends message)
Kafka Topic: assure-code-spec-updates
    ↓ (message queued)
GitHub Actions Consumer
    ↓ (reads message)
Create Pull Request
    ↓ (with updated spec)
Developer Review & Approval
```

## Architecture Components

### ASSURE-CODE Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Kafka Client | `lib/kafka-client.ts` | Manages Kafka producer/consumer connections |
| Webhook Endpoint | `app/api/webhooks/eventid/route.ts` | Receives inbound regulatory events |
| Impact Analysis | `app/api/compliance/analyze-impact/route.ts` | Analyzes which specs are affected |
| Test Dashboard | `app/admin/kafka-test/` | Admin UI for testing connectivity |

### Database Tables

| Table | Purpose |
|-------|---------|
| `regulatory_events` | Stores incoming regulatory changes |
| `compliance_notifications` | Tracks notifications and audit trail |
| `workspaces` | User workspaces with specifications |
| `specifications` | Compliance specifications per workspace |

## Troubleshooting

### "Kafka not configured"
- **Solution:** Add `KAFKA_BROKER_URL` environment variable

### "Connection refused" or timeout
- **Solution:** Verify broker URL is correct: `switchback.proxy.rlwy.net:58989`
- **Check:** Firewall/security group allows outbound connections on port 58989

### "Authentication failed"
- **Solution:** Add `KAFKA_SASL_USERNAME` and `KAFKA_SASL_PASSWORD` if broker requires auth
- **Check:** Credentials are correct

### "Topic does not exist"
- **Solution:** Create required topics in Kafka broker:
  - `assure-code-spec-updates` (outbound)
  - `regulatory-events` (inbound)

### "No messages received from Eventid"
- **Check:** Eventid webhook is configured with correct URL
- **Check:** Eventid has test events to send
- **Test:** Use "Test Webhook Flow" button in `/admin/kafka-test` to simulate

## Security Considerations

### Production Checklist

- [ ] Enable `WEBHOOK_API_KEY` for webhook authentication
- [ ] Use TLS/SSL for Kafka connections (`ssl: true` in config)
- [ ] Use SASL authentication for Kafka broker
- [ ] Restrict webhook endpoint to known IP ranges (firewall rules)
- [ ] Enable audit logging for compliance events
- [ ] Implement rate limiting on webhook endpoint
- [ ] Set up monitoring/alerts for failed messages

## Support

For issues with:
- **ASSURE-CODE configuration:** Check `/admin/kafka-test` diagnostic
- **Kafka broker:** Contact Railway.app or your DevOps team
- **Eventid webhooks:** Contact Eventid support
- **GitHub Actions:** Check workflow logs in GitHub

## Next Steps

1. Add environment variables to Vercel project
2. Run "Test Real Kafka Broker" to verify connection
3. Create Kafka topics (`assure-code-spec-updates`, `regulatory-events`)
4. Configure Eventid webhook URL
5. Set up GitHub Actions consumer workflow
6. Test end-to-end flow with a test regulatory event
