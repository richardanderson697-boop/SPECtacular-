import { sql } from "./db"
import { cookies } from "next/headers"
import bcrypt from "bcryptjs"
import crypto from "crypto"

export interface User {
  id: string
  email: string
  name: string
  created_at: Date
}

export interface Session {
  id: string
  user_id: string
  token: string
  expires_at: Date
}

const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000 // 30 days

export async function hashPassword(password: string): Promise<string> {
  const hash = await bcrypt.hash(password, 12)
  console.log("[v0] Generated hash starts with:", hash.substring(0, 7))
  return hash
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    if (!password || !hash) {
      console.error("[v0] Missing password or hash")
      return false
    }

    const result = await bcrypt.compare(password, hash)
    console.log("[v0] Verification result:", result)
    return result
  } catch (error) {
    console.error("[v0] Password verification error:", error)
    return false
  }
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_DURATION)

  await sql`
    INSERT INTO sessions (user_id, token, expires_at)
    VALUES (${userId}, ${token}, ${expiresAt})
  `

  console.log("[v0] Session created in database for user:", userId)
  return token
}

export function createSessionCookie(token: string): { name: string; value: string; options: any } {
  const expiresAt = new Date(Date.now() + SESSION_DURATION)
  return {
    name: "session",
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      expires: expiresAt,
      path: "/",
      maxAge: SESSION_DURATION / 1000, // in seconds
    },
  }
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value

  if (!token) {
    return null
  }

  const sessions = await sql<Session[]>`
    SELECT * FROM sessions
    WHERE token = ${token} AND expires_at > NOW()
    LIMIT 1
  `

  return sessions[0] || null
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get("session")?.value
  console.log("[v0] getCurrentUser - session token present:", !!sessionToken)
  if (sessionToken) {
    console.log("[v0] getCurrentUser - token value:", sessionToken.substring(0, 8) + "...")
  }

  const allCookies = cookieStore.getAll()
  console.log("[v0] getCurrentUser - all cookies:", allCookies.map((c) => c.name).join(", "))

  const session = await getSession()

  if (!session) {
    console.log("[v0] getCurrentUser - no valid session found")
    return null
  }

  const users = await sql<User[]>`
    SELECT id, email, name, created_at
    FROM users
    WHERE id = ${session.user_id}
    LIMIT 1
  `

  console.log("[v0] getCurrentUser - user found:", !!users[0])
  return users[0] || null
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value

  if (token) {
    await sql`DELETE FROM sessions WHERE token = ${token}`
  }

  cookieStore.delete("session")
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error("Unauthorized")
  }

  return user
}

export async function getCurrentUserFromRequest(request: Request): Promise<User | null> {
  return getUserFromSession(request)
}

export async function requireAuthFromRequest(request: Request): Promise<User> {
  const user = await getUserFromSession(request)

  if (!user) {
    throw new Error("Unauthorized")
  }

  return user
}

export async function getUserFromToken(token: string): Promise<User | null> {
  if (!token) {
    return null
  }

  const sessions = await sql<Session[]>`
    SELECT * FROM sessions
    WHERE token = ${token} AND expires_at > NOW()
    LIMIT 1
  `

  const session = sessions[0]
  if (!session) {
    return null
  }

  const users = await sql<User[]>`
    SELECT id, email, name, created_at
    FROM users
    WHERE id = ${session.user_id}
    LIMIT 1
  `

  return users[0] || null
}

export async function getUserFromSession(request: Request): Promise<User | null> {
  const cookieHeader = request.headers.get("cookie")

  const authHeader = request.headers.get("authorization")
  const tokenFromAuth = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null

  console.log("[v0] getUserFromSession - Cookie header present:", !!cookieHeader)
  console.log("[v0] getUserFromSession - Auth header present:", !!authHeader)

  // Try to get token from cookies first
  let token: string | null = null

  if (cookieHeader) {
    const cookies = cookieHeader.split(";").reduce(
      (acc, cookie) => {
        const [key, value] = cookie.trim().split("=")
        acc[key] = value
        return acc
      },
      {} as Record<string, string>,
    )
    token = cookies.session
  }

  // Fallback to Authorization header if no cookie
  if (!token && tokenFromAuth) {
    token = tokenFromAuth
    console.log("[v0] getUserFromSession - using token from Authorization header")
  }

  if (!token) {
    console.log("[v0] getUserFromSession - no token found")
    return null
  }

  return getUserFromToken(token)
}

export async function verifySession(request: Request): Promise<User | null> {
  return getUserFromSession(request)
}
