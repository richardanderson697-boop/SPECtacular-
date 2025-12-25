import { Kafka, type Producer, type Consumer, type EachMessagePayload } from "kafkajs"

/**
 * Real Kafka Client for bidirectional communication
 * Uses the actual Kafka broker at switchback.proxy.rlwy.net:58989
 */
export class KafkaClient {
  private kafka: Kafka | null = null
  private producer: Producer | null = null
  private consumer: Consumer | null = null
  private brokerUrl: string
  private saslUsername: string | null
  private saslPassword: string | null

  constructor() {
    // Real Kafka broker endpoint
    this.brokerUrl = process.env.KAFKA_BROKER_URL || "switchback.proxy.rlwy.net:58989"
    this.saslUsername = process.env.KAFKA_SASL_USERNAME || null
    this.saslPassword = process.env.KAFKA_SASL_PASSWORD || null

    if (this.brokerUrl) {
      this.initializeKafka()
    }
  }

  private initializeKafka() {
    const config: any = {
      clientId: "assure-code",
      brokers: [this.brokerUrl],
    }

    // Add SASL authentication if credentials provided
    if (this.saslUsername && this.saslPassword) {
      config.sasl = {
        mechanism: "plain",
        username: this.saslUsername,
        password: this.saslPassword,
      }
      config.ssl = true
    }

    this.kafka = new Kafka(config)
    console.log("[v0] KafkaClient: Initialized with broker:", this.brokerUrl)
  }

  /**
   * OUTBOUND: Send spec update to Kafka
   * This sends updated specifications back through Kafka to trigger GitHub PRs
   */
  async sendSpecUpdate(message: {
    workspaceId: string
    specificationId: string
    regulatoryEventId: string
    updatedSpec: string
    impactSummary: string
  }): Promise<{ success: boolean; partition?: number; offset?: string; error?: string }> {
    if (!this.kafka) {
      return {
        success: false,
        error: "Kafka not initialized - missing KAFKA_BROKER_URL",
      }
    }

    try {
      if (!this.producer) {
        this.producer = this.kafka.producer()
        await this.producer.connect()
        console.log("[v0] KafkaClient: Producer connected")
      }

      const result = await this.producer.send({
        topic: "assure-code-spec-updates",
        messages: [
          {
            key: `${message.workspaceId}-${message.specificationId}`,
            value: JSON.stringify({
              type: "SPEC_UPDATE",
              timestamp: new Date().toISOString(),
              workspace_id: message.workspaceId,
              specification_id: message.specificationId,
              regulatory_event_id: message.regulatoryEventId,
              updated_spec: message.updatedSpec,
              impact_summary: message.impactSummary,
              action: "CREATE_PR",
            }),
            headers: {
              source: "assure-code",
              "content-type": "application/json",
            },
          },
        ],
      })

      console.log("[v0] KafkaClient: Message sent successfully", result)

      return {
        success: true,
        partition: result[0].partition,
        offset: result[0].baseOffset,
      }
    } catch (error) {
      console.error("[v0] KafkaClient: Error sending message", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * INBOUND: Start consuming regulatory events from Kafka
   * This listens for incoming regulatory changes from Eventid
   */
  async startConsumer(
    onMessage: (payload: EachMessagePayload) => Promise<void>,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.kafka) {
      return {
        success: false,
        error: "Kafka not initialized - missing KAFKA_BROKER_URL",
      }
    }

    try {
      if (!this.consumer) {
        this.consumer = this.kafka.consumer({ groupId: "assure-code-consumers" })
        await this.consumer.connect()
        console.log("[v0] KafkaClient: Consumer connected")

        await this.consumer.subscribe({
          topic: "regulatory-events",
          fromBeginning: false,
        })

        await this.consumer.run({
          eachMessage: onMessage,
        })

        console.log("[v0] KafkaClient: Consumer started listening on 'regulatory-events' topic")
      }

      return { success: true }
    } catch (error) {
      console.error("[v0] KafkaClient: Error starting consumer", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Test connection to Kafka broker
   */
  async testConnection(): Promise<{ success: boolean; brokers?: string[]; error?: string }> {
    if (!this.kafka) {
      return {
        success: false,
        error: "Kafka not initialized - missing KAFKA_BROKER_URL",
      }
    }

    try {
      const admin = this.kafka.admin()
      await admin.connect()
      console.log("[v0] KafkaClient: Admin connected for testing")

      const cluster = await admin.describeCluster()
      await admin.disconnect()

      return {
        success: true,
        brokers: cluster.brokers.map((b) => `${b.host}:${b.port}`),
      }
    } catch (error) {
      console.error("[v0] KafkaClient: Connection test failed", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Disconnect all Kafka connections
   */
  async disconnect(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect()
      console.log("[v0] KafkaClient: Producer disconnected")
    }
    if (this.consumer) {
      await this.consumer.disconnect()
      console.log("[v0] KafkaClient: Consumer disconnected")
    }
  }

  isConfigured(): boolean {
    return Boolean(this.brokerUrl)
  }
}

// Singleton instance
let kafkaClient: KafkaClient | null = null

export function getKafkaClient(): KafkaClient {
  if (!kafkaClient) {
    kafkaClient = new KafkaClient()
  }
  return kafkaClient
}
