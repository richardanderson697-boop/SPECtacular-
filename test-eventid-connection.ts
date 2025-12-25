// Test script to verify Eventid connection
// Run with: npx tsx scripts/test-eventid-connection.ts

const EVENT_API_BASE_URL =
  process.env.EVENT_API_BASE_URL || "https://v0-eventid-uuid-v7-eventversion-1-production.up.railway.app"
const CLIENT_ID = process.env.EVENT_API_CLIENT_ID || "assure-code-client"
const CLIENT_SECRET = process.env.EVENT_API_CLIENT_SECRET || ""

async function testConnection() {
  console.log("\n🔍 Testing Eventid Connection\n")
  console.log("Configuration:")
  console.log(`  Base URL: ${EVENT_API_BASE_URL}`)
  console.log(`  Client ID: ${CLIENT_ID}`)
  console.log(`  Has Secret: ${CLIENT_SECRET ? "✓" : "✗"}\n`)

  if (!CLIENT_SECRET) {
    console.error("❌ EVENT_API_CLIENT_SECRET is not set")
    console.log("\nPlease set the environment variable and try again.")
    process.exit(1)
  }

  // Test 1: Check if Eventid is reachable
  console.log("Test 1: Checking Eventid availability...")
  try {
    const healthCheck = await fetch(`${EVENT_API_BASE_URL}/health`, {
      method: "GET",
    })

    if (healthCheck.ok) {
      console.log("✓ Eventid is reachable")
    } else {
      console.log(`⚠ Eventid returned: ${healthCheck.status}`)
    }
  } catch (error) {
    console.error("✗ Cannot reach Eventid:", error instanceof Error ? error.message : error)
    process.exit(1)
  }

  // Test 2: OAuth Token Request
  console.log("\nTest 2: Requesting OAuth token...")
  try {
    const tokenResponse = await fetch(`${EVENT_API_BASE_URL}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error(`✗ OAuth failed (${tokenResponse.status}):`, errorText)
      console.log("\nTroubleshooting:")
      console.log("  1. Verify CLIENT_ID and CLIENT_SECRET are correct")
      console.log("  2. Check if OAuth client exists in Eventid")
      console.log("  3. Review Eventid logs in Railway")
      process.exit(1)
    }

    const tokenData = await tokenResponse.json()
    console.log("✓ OAuth token obtained successfully")
    console.log(`  Token type: ${tokenData.token_type}`)
    console.log(`  Expires in: ${tokenData.expires_in}s`)

    // Test 3: Send a test event
    console.log("\nTest 3: Sending test event...")
    const testEvent = {
      eventType: "system.test.connection",
      workspaceId: "test-workspace",
      userId: "test-user",
      metadata: {
        test: true,
        timestamp: new Date().toISOString(),
      },
      source: "assure-code-test-script",
    }

    const eventResponse = await fetch(`${EVENT_API_BASE_URL}/api/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenData.access_token}`,
      },
      body: JSON.stringify(testEvent),
    })

    if (!eventResponse.ok) {
      const errorText = await eventResponse.text()
      console.error(`✗ Event submission failed (${eventResponse.status}):`, errorText)
      process.exit(1)
    }

    const eventResult = await eventResponse.json()
    console.log("✓ Test event sent successfully")
    console.log(`  Event ID: ${eventResult.event_id || eventResult.id || "N/A"}`)

    console.log("\n✅ All tests passed! Eventid integration is working correctly.\n")
  } catch (error) {
    console.error("\n✗ Test failed:", error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

testConnection()
