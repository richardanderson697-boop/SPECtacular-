import { sql } from "./db"

export interface Workspace {
  id: string
  name: string
  owner_id: string
  is_personal: boolean
  created_at: Date
}

export async function getUserWorkspaces(userId: string): Promise<Workspace[]> {
  const workspaces = await sql<Workspace[]>`
    SELECT DISTINCT w.*
    FROM workspaces w
    LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
    WHERE w.owner_id = ${userId} OR wm.user_id = ${userId}
    ORDER BY w.is_personal DESC, w.created_at DESC
  `

  return workspaces
}

export async function createPersonalWorkspace(userId: string, userName: string): Promise<Workspace> {
  const workspaces = await sql<Workspace[]>`
    INSERT INTO workspaces (name, owner_id, is_personal)
    VALUES (${userName}, ${userId}, true)
    RETURNING *
  `

  return workspaces[0]
}

export async function createWorkspace(name: string, ownerId: string): Promise<Workspace> {
  const workspaces = await sql<Workspace[]>`
    INSERT INTO workspaces (name, owner_id, is_personal)
    VALUES (${name}, ${ownerId}, false)
    RETURNING *
  `

  return workspaces[0]
}

export async function getWorkspace(workspaceId: string, userId: string): Promise<Workspace | null> {
  const workspaces = await sql<Workspace[]>`
    SELECT DISTINCT w.*
    FROM workspaces w
    LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
    WHERE w.id = ${workspaceId} AND (w.owner_id = ${userId} OR wm.user_id = ${userId})
    LIMIT 1
  `

  return workspaces[0] || null
}
