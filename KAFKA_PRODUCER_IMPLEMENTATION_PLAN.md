# Kafka Producer Implementation for ASSURE-CODE

## What Needs to Be Built

Since you confirmed Kafka dashboard shows no activity, we need to implement **actual Kafka message production** from ASSURE-CODE.

## Current Gap
The `lib/kafka-producer.ts` file uses KafkaJS, but:
1. It won't work in v0 browser environment (TCP limitation)
2. It WILL work when deployed to Vercel (full Node.js)
3. It's not being called by the actual business logic yet

## Implementation Required

### 1. Add Kafka Producer Call to Webhook Handler
When ASSURE-CODE processes a HIGH/CRITICAL regulatory event:

```typescript
// In app/api/webhooks/eventid/route.ts
import { KafkaProducer } from "@/lib/kafka-producer"

// After creating notifications, send to Kafka
if (event.severity === "HIGH" || event.severity === "CRITICAL") {
  const producer = new KafkaProducer()
  
  for (const workspace of workspaces) {
    await producer.sendComplianceUpdate({
      workspaceId: workspace.id,
      specType: "all",
      changes: {
        regulatoryEvent: event.event_id,
        framework: event.framework,
        requiresReview: true
      },
      regulatoryEventId: event.event_id,
      timestamp: new Date().toISOString()
    })
  }
}
```

### 2. Deployment to Vercel Required
To test Kafka producer:
1. Deploy ASSURE-CODE to Vercel
2. Add environment variables in Vercel dashboard:
   - `KAFKA_BROKER_URL=switchback.proxy.rlwy.net:58989`
3. Send test webhook to production URL
4. Check Kafka UI - should see messages in `assure-code-spec-updates` topic

### 3. Kafka Platform Configuration Needed
On the Kafka/Eventid side:
- Create topic: `assure-code-spec-updates` (if doesn't exist)
- Verify ASSURE-CODE has write permissions
- Set up GitHub Actions consumer listening to this topic

## Why No Activity in Kafka Dashboard?

Current situation:
- Eventid may NOT be producing to Kafka at all
- OR topic names don't match
- OR ASSURE-CODE webhook endpoint is being called directly via HTTP (bypassing Kafka)

**To see activity in Kafka dashboard, one of these must happen:**
1. Eventid produces messages to `regulatory-events` topic
2. ASSURE-CODE produces messages to `assure-code-spec-updates` topic
3. Any service publishes to any topic on that Kafka cluster

**If nothing shows in Kafka UI:**
- The Kafka cluster has zero message traffic
- Need to configure publishers/consumers
