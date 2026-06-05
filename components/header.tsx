'use client'

import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Trophy, LogOut, User, BarChart3, Settings } from 'lucide-react'

export function Header({
  userName,
  isAdmin,
}: {
  userName?: string
  isAdmin?: boolean
}) {
  const router = useRouter()

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push('/sign-in')
    router.refresh()
  }

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <img src="/icon.svg" alt="Koywe" className="h-9 w-9 rounded-lg" />
          <span className="text-lg font-bold text-foreground">
            Prediction Markets
          </span>
          <img src="/koywe-logo.svg" alt="Koywe" className="mt-1 h-5" />
        </Link>

        {userName ? (
          <nav className="flex items-center gap-1">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <BarChart3 className="mr-2 h-4 w-4" />
                Partidos
              </Button>
            </Link>
            <Link href="/leaderboard">
              <Button variant="ghost" size="sm">
                <Trophy className="mr-2 h-4 w-4" />
                Ranking
              </Button>
            </Link>
            {isAdmin && (
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  <Settings className="mr-2 h-4 w-4" />
                  Admin
                </Button>
              </Link>
            )}
            <div className="ml-2 flex items-center gap-2 border-l pl-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                <User className="h-4 w-4 text-secondary-foreground" />
              </div>
              <span className="text-sm font-medium">{userName}</span>
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </nav>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/sign-in">
              <Button variant="ghost" size="sm">
                Iniciar sesion
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm">Registrarse</Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
