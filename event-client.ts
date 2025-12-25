interface EventPayload {
  eventType: string
  workspaceId: string
  userId: string
  metadata: Record<string, any>
  timestamp?: string
}

interface OAuthToken {
  access_token: string
  token_type: string
  expires_in: number
  expires_at: number
}

class EventAPIClient {
  private baseUrl: string
  private clientId: string
  private clientSecret: string
  private tokenCache: OAuthToken | null = null

  constructor() {
    this.baseUrl = process.env.EVENT_API_BASE_URL || ""
    this.clientId = process.env.EVENT_API_CLIENT_ID || ""
    this.clientSecret = process.env.EVENT_API_CLIENT_SECRET || ""
  }

  // Get OAuth 2.0 access token
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (
      this.tokenCache &&
      this.tokenCache.expires_at > Date.now() + 60000 // 1 minute buffer
    ) {
      return this.tokenCache.access_token
    }

    try {
      // Request new token using client credentials flow
      const response = await fetch(`${this.baseUrl}/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      })

      if (!response.ok) {
        throw new Error(`OAuth token request failed: ${response.statusText}`)
      }

      const data = await response.json()

      // Cache the token with expiration
      this.tokenCache = {
        access_token: data.access_token,
        token_type: data.token_type,
        expires_in: data.expires_in,
        expires_at: Date.now() + data.expires_in * 1000,
      }

      return data.access_token
    } catch (error) {
      console.error("[v0] Failed to get OAuth token:", error)
      throw error
    }
  }

  // Send event to the Event API
  async sendEvent(payload: EventPayload): Promise<void> {
    // Skip if EVENT_API_BASE_URL is not configured
    if (!this.baseUrl) {
      console.log("[v0] Event API not configured, skipping event logging")
      return
    }

    try {
      const accessToken = await this.getAccessToken()

      const eventData = {
        ...payload,
        timestamp: payload.timestamp || new Date().toISOString(),
        source: "swiftly-spec-generator",
      }

      const response = await fetch(`${this.baseUrl}/api/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(eventData),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Event API request failed: ${response.status} ${errorText}`)
      }

      console.log("[v0] Event logged successfully:", payload.eventType)
    } catch (error) {
      // Don't fail the main operation if event logging fails
      console.error("[v0] Failed to log event:", error)
    }
  }

  // Log compliance check event
  async logComplianceCheck(
    workspaceId: string,
    userId: string,
    result: {
      frameworks: string[]
      severity: string
      violations: any[]
    },
  ): Promise<void> {
    await this.sendEvent({
      eventType: "compliance.check.completed",
      workspaceId,
      userId,
      metadata: {
        frameworks: result.frameworks,
        severity: result.severity,
        violationCount: result.violations.length,
        hasBlockingViolations: result.severity === "blocking-violations",
      },
    })
  }

  // Log specification generation event
  async logSpecificationGeneration(
    workspaceId: string,
    userId: string,
    specificationId: string,
    success: boolean,
  ): Promise<void> {
    await this.sendEvent({
      eventType: success ? "specification.generated.success" : "specification.generated.failure",
      workspaceId,
      userId,
      metadata: {
        specificationId,
      },
    })
  }

  // Log workspace creation event
  async logWorkspaceCreated(workspaceId: string, userId: string, name: string): Promise<void> {
    await this.sendEvent({
      eventType: "workspace.created",
      workspaceId,
      userId,
      metadata: {
        workspaceName: name,
      },
    })
  }

  // Log authentication event
  async logAuthEvent(userId: string, eventType: "signin" | "signup" | "signout"): Promise<void> {
    await this.sendEvent({
      eventType: `auth.${eventType}`,
      workspaceId: "system",
      userId,
      metadata: {},
    })
  }
}

// Export singleton instance
export const eventClient = new EventAPIClient()
