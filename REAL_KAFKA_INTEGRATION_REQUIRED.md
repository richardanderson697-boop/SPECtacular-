# Real Kafka Integration Requirements

## CURRENT STATE (What We Have)
- Database tables created and working
- HTTP webhook endpoint at `/api/webhooks/eventid` 
- Code written but NOT connected to Kafka

## THE PROBLEM
**NO messages are flowing through Kafka because:**
1. ASSURE-CODE is not consuming from any Kafka topics
2. ASSURE-CODE is not producing to any Kafka topics
3. The webhook receives direct HTTP POSTs (not Kafka messages)

## WHAT'S NEEDED FOR REAL BIDIRECTIONAL FLOW

### Architecture Option 1: Kafka-Native (Recommended)
```
Regulatory Feed → Kafka Topic → ASSURE-CODE Consumer → Database
                                         ↓
Database → ASSURE-CODE Producer → Kafka Topic → GitHub Actions
```

**Requirements:**
1. **Kafka Topics Must Exist:**
   - `regulatory-events` (for inbound regulatory changes)
   - `assure-code-spec-updates` (for outbound spec updates)

2. **ASSURE-CODE Needs:**
   - Kafka consumer process listening to `regulatory-events` topic
   - Kafka producer to send messages to `assure-code-spec-updates` topic
   - Environment variables:
     ```
     KAFKA_BROKER_URL=switchback.proxy.rlwy.net:58989
     KAFKA_CONSUMER_GROUP=assure-code-consumers
     KAFKA_TOPIC_INBOUND=regulatory-events
     KAFKA_TOPIC_OUTBOUND=assure-code-spec-updates
     ```

3. **Eventid Platform Needs:**
   - Kafka producer sending to `regulatory-events` topic
   - NOT sending webhooks directly to ASSURE-CODE

4. **GitHub Actions Needs:**
   - Kafka consumer listening to `assure-code-spec-updates` topic
   - Process messages and create PRs

**Problem with v0 environment:**
- Cannot run long-lived Kafka consumer processes in v0 preview
- Need to deploy to Vercel or separate consumer service

---

### Architecture Option 2: Hybrid HTTP + Kafka (Alternative)
```
Regulatory Feed → Kafka Topic → Eventid Bridge → Webhook → ASSURE-CODE
                                                              ↓
                                                         Database
                                                              ↓
                                    ASSURE-CODE → Kafka Topic → GitHub Actions
```

**Requirements:**
1. **Eventid Platform Side:**
   - Consume from Kafka `regulatory-events` topic
   - Send HTTP webhook to ASSURE-CODE: `https://your-app.vercel.app/api/webhooks/eventid`
   - This bridges Kafka → HTTP (you may already have this)

2. **ASSURE-CODE Side:**
   - Receive webhooks (already working!)
   - Produce to Kafka `assure-code-spec-updates` topic (needs implementation)
   - Environment variable: `KAFKA_BROKER_URL=switchback.proxy.rlwy.net:58989`

3. **GitHub Actions Side:**
   - Consume from `assure-code-spec-updates` Kafka topic
   - Create PRs when messages received

**This option is more feasible because:**
- ASSURE-CODE only needs to PRODUCE (not consume)
- Producing can happen on-demand (not long-running process)
- Works better with serverless deployment

---

## RECOMMENDED NEXT STEPS

### Immediate Actions (Kafka Platform Team):
1. **Verify topics exist:**
   ```bash
   # Check if these topics exist in your Kafka cluster:
   - regulatory-events
   - assure-code-spec-updates
   ```

2. **Configure Eventid platform:**
   - Either send messages directly to Kafka topic, OR
   - Send webhook to: `https://your-assure-code-url.vercel.app/api/webhooks/eventid`

3. **Test message flow:**
   - Send a test regulatory event
   - Verify it appears in Kafka UI dashboard

### ASSURE-CODE Actions (Our Side):
1. **Add Kafka producer integration** (can be done now)
2. **Deploy to Vercel** (Kafka producer will work in production)
3. **Add environment variables:**
   - `KAFKA_BROKER_URL=switchback.proxy.rlwy.net:58989`
   - Optionally: `KAFKA_SASL_USERNAME` and `KAFKA_SASL_PASSWORD`

---

## TESTING REAL KAFKA FLOW

Once configured, you should see in Kafka UI dashboard:
- **Topic: regulatory-events** → Messages coming in from Eventid
- **Topic: assure-code-spec-updates** → Messages going out from ASSURE-CODE

**If dashboard shows ZERO activity:**
- No messages are flowing through Kafka
- Integration is not actually connected
- Need configuration on Kafka platform side
