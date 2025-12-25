# Kafka Bridge Verification Plan

## Step 1: Test Kafka Connection (Local)

Before deploying anything, verify you can connect to your Kafka broker.

### Install KafkaJS locally:
```bash
npm install kafkajs
```

### Create test-kafka.js:
```javascript
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'assure-code-test',
  brokers: ['switchback.proxy.rlwy.net:58989'],
  // Add if needed:
  // ssl: true,
  // sasl: {
  //   mechanism: 'plain',
  //   username: 'your-username',
  //   password: 'your-password'
  // }
});

async function testConnection() {
  const admin = kafka.admin();
  try {
    console.log('Connecting to Kafka...');
    await admin.connect();
    console.log('✅ Connected to Kafka successfully!');
    
    const topics = await admin.listTopics();
    console.log('Existing topics:', topics);
    
    await admin.disconnect();
    console.log('✅ Test completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    return false;
  }
}

testConnection();
```

### Run the test:
```bash
node test-kafka.js
```

**Expected Result:** Should connect and list topics. If this fails, we need to fix Kafka credentials before deploying the bridge.

---

## Step 2: Test Producer (ASSURE-CODE → Kafka)

Create test-producer.js:
```javascript
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'assure-code-producer-test',
  brokers: ['switchback.proxy.rlwy.net:58989'],
});

async function testProducer() {
  const producer = kafka.producer();
  
  try {
    await producer.connect();
    console.log('✅ Producer connected');
    
    const result = await producer.send({
      topic: 'assure-code-spec-updates',
      messages: [
        {
          key: 'test-spec-123',
          value: JSON.stringify({
            workspaceId: 'test-workspace',
            specId: 'test-spec-123',
            action: 'update',
            timestamp: new Date().toISOString()
          })
        }
      ]
    });
    
    console.log('✅ Message sent:', result);
    await producer.disconnect();
    return true;
  } catch (error) {
    console.error('❌ Producer failed:', error.message);
    return false;
  }
}

testProducer();
```

**Expected Result:** Should send a message to Kafka. Check your Kafka dashboard - you should see activity!

---

## Step 3: Test Consumer (Kafka → HTTP Webhook)

Create test-consumer.js:
```javascript
const { Kafka } = require('kafkajs');
const fetch = require('node-fetch');

const kafka = new Kafka({
  clientId: 'assure-code-consumer-test',
  brokers: ['switchback.proxy.rlwy.net:58989'],
});

async function testConsumer() {
  const consumer = kafka.consumer({ groupId: 'test-group' });
  
  try {
    await consumer.connect();
    console.log('✅ Consumer connected');
    
    await consumer.subscribe({ 
      topic: 'regulatory-events',
      fromBeginning: false 
    });
    
    console.log('Listening for messages (press Ctrl+C to stop)...');
    
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const data = JSON.parse(message.value.toString());
        console.log('📥 Received message:', data);
        
        // Test forwarding to ASSURE-CODE
        try {
          const response = await fetch('http://localhost:3000/api/webhooks/kafka-bridge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          
          if (response.ok) {
            console.log('✅ Forwarded to ASSURE-CODE');
          } else {
            console.log('⚠️ Forward failed:', response.status);
          }
        } catch (error) {
          console.log('⚠️ Forward error:', error.message);
        }
      }
    });
  } catch (error) {
    console.error('❌ Consumer failed:', error.message);
  }
}

testConsumer();
```

**Expected Result:** Should listen for messages. When you run the producer test, this should receive and forward them.

---

## Step 4: End-to-End Test

1. Start ASSURE-CODE locally: `npm run dev`
2. Run the consumer test: `node test-consumer.js`
3. In another terminal, run the producer test: `node test-producer.js`

**Expected Flow:**
```
Producer → Kafka Topic → Consumer → HTTP POST → ASSURE-CODE → Database
```

Check your database - you should see the test event stored.

---

## Deployment Checklist

Only deploy the bridge if ALL tests pass:

- [ ] Step 1: Kafka connection works
- [ ] Step 2: Producer can send messages (see activity in Kafka dashboard)
- [ ] Step 3: Consumer can receive messages
- [ ] Step 4: End-to-end flow completes successfully

## If Tests Fail

**Connection Failed:**
- Check if Kafka broker requires authentication (SASL username/password)
- Verify the broker URL is correct: `switchback.proxy.rlwy.net:58989`
- Check if SSL is required

**Topic Not Found:**
- Create topics manually in Kafka dashboard:
  - `regulatory-events` (for inbound)
  - `assure-code-spec-updates` (for outbound)

**Can't Send Messages:**
- Check if your Kafka has ACLs (access control lists) enabled
- Verify your client has write permissions

---

## Next Steps After Verification

Once all tests pass:
1. Deploy the bridge to Railway
2. Update ASSURE-CODE environment variables
3. Configure Eventid to publish to Kafka topic
4. Monitor both Kafka dashboard and ASSURE-CODE logs

The bridge will just be running these same test scripts 24/7 in production.
