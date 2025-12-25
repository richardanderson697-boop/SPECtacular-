# ASSURE-CODE Kafka Bridge Service

This lightweight service bridges Kafka and your serverless ASSURE-CODE platform, enabling true bidirectional communication.

## What It Does

**Inbound Flow:**
```
Regulatory Feed → Kafka Topic → Bridge Consumer → HTTP POST → ASSURE-CODE
```

**Outbound Flow:**
```
ASSURE-CODE → Kafka REST Proxy → Kafka Topic → GitHub Actions
```

## Deployment to Railway

1. **Create New Service on Railway:**
   ```bash
   # In your Railway dashboard, create a new service from this directory
   railway up
   ```

2. **Set Environment Variables:**
   - `KAFKA_BROKER`: `switchback.proxy.rlwy.net:58989` (already set)
   - `ASSURE_CODE_WEBHOOK_URL`: Your Vercel deployment URL + `/api/webhooks/eventid`
   - `KAFKA_USERNAME`: (if your broker requires auth)
   - `KAFKA_PASSWORD`: (if your broker requires auth)

3. **Create Kafka Topics:**
   ```bash
   # regulatory-events (inbound from regulatory sources)
   # compliance-updates (general compliance changes)
   # assure-code-spec-updates (outbound to GitHub Actions)
   ```

## How It Works

1. **Consumes from Kafka** topics continuously
2. **Forwards messages** to ASSURE-CODE via HTTP webhook
3. **Maintains persistent connection** to Kafka broker
4. **Handles reconnection** automatically if connection drops
5. **Provides health checks** for Railway monitoring

## Testing

Once deployed, you can test by:
1. Publishing a message to `regulatory-events` topic on Kafka
2. Check Railway logs to see the bridge receive it
3. Verify ASSURE-CODE webhook receives the data
4. Check your ASSURE-CODE database for the stored event

## Outbound (ASSURE-CODE → Kafka)

ASSURE-CODE can send messages TO Kafka using the producer code that's already in `lib/kafka-producer.ts`. Since this is request-initiated (not continuous listening), it works fine from Vercel serverless.
