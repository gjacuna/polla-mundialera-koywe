import { auth } from '@/lib/auth'
import { isAdminEmail } from '@/lib/admin'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getMatches } from '@/app/actions/predictions'
import { Header } from '@/components/header'
import { AdminPanel } from '@/components/admin-panel'
import { Settings } from 'lucide-react'

export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    redirect('/sign-in')
  }

  if (!isAdminEmail(session.user.email)) {
    redirect('/')
  }

  const matches = await getMatches()

  return (
    <div className="min-h-screen bg-background">
      <Header userName={session.user.name} isAdmin />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center gap-3">
          <Settings className="h-8 w-8 text-secondary" />
          <h1 className="text-3xl font-bold">Panel de Administracion</h1>
        </div>

        <AdminPanel matches={matches} />
      </main>
    </div>
  )
}
