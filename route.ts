import { type NextRequest, NextResponse } from "next/server"
import { requireAuthFromRequest } from "@/lib/auth"
import { getUserWorkspaces, createWorkspace } from "@/lib/workspaces"
import { eventClient } from "@/lib/event-client"

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request)
    const workspaces = await getUserWorkspaces(user.id)

    return NextResponse.json({ workspaces })
  } catch (error) {
    console.error("Get workspaces error:", error)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request)
    const { name } = await request.json()

    if (!name) {
      return NextResponse.json({ error: "Workspace name is required" }, { status: 400 })
    }

    const workspace = await createWorkspace(name, user.id)

    try {
      await eventClient.logWorkspaceCreated(workspace.id, user.id, name)
    } catch (eventError) {
      console.error("[v0] Failed to log event (non-critical):", eventError)
    }

    return NextResponse.json({ workspace }, { status: 201 })
  } catch (error) {
    console.error("Create workspace error:", error)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
