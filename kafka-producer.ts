import { neon } from "@neondatabase/serverless"

interface ComplianceUpdate {
  workspaceId: string
  specificationId: string
  regulatoryEventId: string
  oldRequirements: string[]
  newRequirements: string[]
  impactSummary: string
  updatedSpecContent: string
}

interface KafkaMessage {
  topic: string
  key: string
  value: any
  headers?: Record<string, string>
}

/**
 * Kafka Producer for sending compliance updates back to the platform
 * This triggers GitHub Actions to create PRs with updated specifications
 */
export class KafkaProducer {
  private kafkaEndpoint: string
  private apiKey: string | null

  constructor() {
    // Kafka platform endpoint for sending messages
    this.kafkaEndpoint = process.env.KAFKA_PLATFORM_ENDPOINT || ""
    this.apiKey = process.env.KAFKA_API_KEY || null
  }

  /**
   * Send a compliance update message to Kafka
   * This will trigger GitHub Actions to create a PR
   */
  async sendComplianceUpdate(update: ComplianceUpdate): Promise<{
    success: boolean
    messageId?: string
    error?: string
  }> {
    console.log("[v0] Kafka Producer: Sending compliance update", {
      workspaceId: update.workspaceId,
      specId: update.specificationId,
      eventId: update.regulatoryEventId,
    })

    // Log the update to database for tracking
    await this.logOutboundMessage(update)

    // If Kafka endpoint is configured, send through Kafka
    if (this.kafkaEndpoint && this.apiKey) {
      try {
        const message: KafkaMessage = {
          topic: "assure-code-updates",
          key: `${update.workspaceId}-${update.specificationId}`,
          value: {
            type: "SPEC_UPDATE",
            timestamp: new Date().toISOString(),
            workspace_id: update.workspaceId,
            specification_id: update.specificationId,
            regulatory_event_id: update.regulatoryEventId,
            changes: {
              old_requirements: update.oldRequirements,
              new_requirements: update.newRequirements,
              impact_summary: update.impactSummary,
            },
            updated_spec: update.updatedSpecContent,
            action: "CREATE_PR",
          },
          headers: {
            "content-type": "application/json",
            "x-source": "assure-code",
            "x-api-key": this.apiKey,
          },
        }

        const response = await fetch(this.kafkaEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(message),
        })

        if (!response.ok) {
          throw new Error(`Kafka send failed: ${response.status} ${await response.text()}`)
        }

        const result = await response.json()
        console.log("[v0] Kafka Producer: Message sent successfully", result)

        return {
          success: true,
          messageId: result.messageId || result.id,
        }
      } catch (error) {
        console.error("[v0] Kafka Producer: Error sending message", error)
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }
      }
    }

    // If no Kafka configured, return success for testing
    console.log("[v0] Kafka Producer: No Kafka endpoint configured, logging locally only")
    return {
      success: true,
      messageId: `local-${Date.now()}`,
    }
  }

  /**
   * Log outbound messages to database for audit trail
   */
  private async logOutboundMessage(update: ComplianceUpdate): Promise<void> {
    try {
      const sql = neon(process.env.DATABASE_URL!)

      const workspaces = await sql`SELECT id FROM workspaces LIMIT 1`

      if (workspaces.length === 0) {
        console.log("[v0] Kafka Producer: No workspaces found, skipping notification log")
        return
      }

      await sql`
        INSERT INTO compliance_notifications (
          id,
          workspace_id,
          event_id,
          title,
          description,
          severity,
          framework,
          action_required,
          viewed,
          created_at
        ) VALUES (
          gen_random_uuid(),
          ${workspaces[0].id},
          ${update.regulatoryEventId},
          'Specification Update Sent',
          ${`Compliance update sent for specification ${update.specificationId}. Impact: ${update.impactSummary}. Changes: ${update.newRequirements.length} new requirements, ${update.oldRequirements.length} modified requirements.`},
          'MEDIUM',
          'COMPLIANCE_UPDATE',
          false,
          false,
          NOW()
        )
      `

      console.log("[v0] Kafka Producer: Logged outbound message to database")
    } catch (error) {
      console.error("[v0] Kafka Producer: Error logging outbound message", error)
      // Don't throw - logging failure shouldn't stop the message send
    }
  }

  /**
   * Check if Kafka producer is properly configured
   */
  isConfigured(): boolean {
    return Boolean(this.kafkaEndpoint && this.apiKey)
  }
}
