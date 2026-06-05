import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false
  const admins = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return admins.includes(email.toLowerCase())
}

export async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user || !isAdminEmail(session.user.email)) {
    throw new Error('Unauthorized')
  }
  return session.user
}
