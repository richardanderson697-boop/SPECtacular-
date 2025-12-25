# Complete Bidirectional Kafka Integration

Your end-to-end continuous compliance monitoring system with Kafka as the message backbone.

## Architecture Overview

```
┌─────────────────────┐
│  Regulatory Feeds   │
│  (Eventid, etc.)    │
└──────────┬──────────┘
           │
           ▼
    ┌─────────────┐
    │   Kafka     │◄───────────────────┐
    │   Broker    │                    │
    │  (Railway)  │                    │
    └──────┬──────┘                    │
           │                           │
           │ (consumes)                │ (produces)
           ▼                           │
    ┌─────────────┐                    │
    │ Kafka Bridge│                    │
    │  (Railway)  │                    │
    └──────┬──────┘                    │
           │                           │
           │ (HTTP POST)               │
           ▼                           │
    ┌─────────────────┐                │
    │  ASSURE-CODE    │────────────────┘
    │   (Vercel)      │
    │                 │
    │ - Analyzes      │
    │ - Generates     │
    │ - Updates Specs │
    └────────┬────────┘
             │
             │ (Kafka produces spec updates)
             ▼
      ┌─────────────┐
      │   Kafka     │
      │   Topic     │
      └──────┬──────┘
             │
             ▼
      ┌─────────────┐
      │   GitHub    │
      │   Actions   │
      │  (Creates   │
      │    PRs)     │
      └─────────────┘
```

## Deployment Steps

### 1. Deploy Kafka Bridge to Railway

```bash
cd kafka-bridge
railway up
```

**Environment Variables to Set:**
- `KAFKA_BROKER=switchback.proxy.rlwy.net:58989`
- `ASSURE_CODE_WEBHOOK_URL=https://your-app.vercel.app/api/webhooks/kafka-bridge`
- `KAFKA_USERNAME=` (if needed)
- `KAFKA_PASSWORD=` (if needed)

### 2. Create Kafka Topics

On your Kafka broker, create these topics:
- `regulatory-events` - Inbound regulatory changes
- `compliance-updates` - General compliance notifications  
- `assure-code-spec-updates` - Outbound specification updates

### 3. Deploy ASSURE-CODE to Vercel

```bash
vercel deploy --prod
```

**Environment Variables to Set:**
- `DATABASE_URL` (already set - Neon)
- `KAFKA_BROKER_URL=switchback.proxy.rlwy.net:58989`
- `KAFKA_USERNAME=` (if needed)
- `KAFKA_PASSWORD=` (if needed)

### 4. Configure GitHub Actions Consumer

Create a service that consumes from `assure-code-spec-updates` and creates PRs.

## Complete Flow

### Inbound (Regulatory Change → ASSURE-CODE):

1. **Regulatory feed** publishes to Kafka topic `regulatory-events`
2. **Kafka Bridge** consumes message continuously
3. **Bridge POSTs** to `/api/webhooks/kafka-bridge` on ASSURE-CODE
4. **ASSURE-CODE** stores event, analyzes impact, creates notifications
5. **Database** stores affected workspaces and compliance status

### Outbound (ASSURE-CODE → GitHub PR):

1. **ASSURE-CODE** detects spec needs updating
2. **Produces message** to Kafka topic `assure-code-spec-updates`
3. **GitHub Actions consumer** receives message
4. **Creates PR** with updated specification
5. **Developer reviews** and approves

## Testing End-to-End

1. Publish test message to `regulatory-events` topic
2. Watch Railway logs for bridge receiving it
3. Check Vercel logs for webhook processing
4. Verify database has new regulatory event
5. Confirm affected workspaces got notifications
6. Test outbound by triggering spec update
7. Verify message appears in Kafka dashboard
8. Confirm GitHub PR is created

## Why This Works

✅ **Kafka Bridge runs 24/7** on Railway (persistent process)
✅ **ASSURE-CODE stays serverless** on Vercel
✅ **True bidirectional** Kafka communication
✅ **Continuous monitoring** of regulatory changes
✅ **Automated compliance** with human review
✅ **Full message audit trail** in Kafka
✅ **Scalable architecture** that matches your vision

## Cost

- Railway: ~$5-10/month for small bridge service
- Kafka broker: Already running
- ASSURE-CODE: Already on Vercel (free tier or existing plan)

**Total additional cost: ~$5-10/month to connect both platforms**
