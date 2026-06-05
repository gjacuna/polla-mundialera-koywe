'use client'

import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Trophy,
  LogOut,
  User,
  BarChart3,
  Settings,
  TrendingUp,
} from 'lucide-react'

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
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <img
            src="/icon.svg"
            alt="Koywe"
            className="h-9 w-9 shrink-0 rounded-lg"
          />
          <span className="hidden whitespace-nowrap text-lg font-bold text-foreground min-[480px]:inline">
            Prediction Markets
          </span>
          <img
            src="/koywe-logo.svg"
            alt="Koywe"
            className="mt-1 hidden h-5 md:block"
          />
        </Link>

        {userName ? (
          <nav className="flex items-center gap-0.5 sm:gap-1">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <BarChart3 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Partidos</span>
              </Button>
            </Link>
            <Link href="/simulacion">
              <Button variant="ghost" size="sm">
                <TrendingUp className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Simulacion</span>
              </Button>
            </Link>
            <Link href="/leaderboard">
              <Button variant="ghost" size="sm">
                <Trophy className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Ranking</span>
              </Button>
            </Link>
            {isAdmin && (
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  <Settings className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Admin</span>
                </Button>
              </Link>
            )}
            <div className="ml-1 flex items-center gap-1 border-l pl-2 sm:ml-2 sm:gap-2 sm:pl-4">
              <div className="hidden h-8 w-8 items-center justify-center rounded-full bg-secondary sm:flex">
                <User className="h-4 w-4 text-secondary-foreground" />
              </div>
              <span className="hidden text-sm font-medium md:inline">
                {userName}
              </span>
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
