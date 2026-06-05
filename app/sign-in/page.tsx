import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy } from 'lucide-react'

export default async function SignInPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (session?.user) {
    redirect('/')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-8 flex items-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <Trophy className="h-6 w-6 text-primary-foreground" />
        </div>
        <span className="text-2xl font-bold">Polla Koywe</span>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Bienvenido</CardTitle>
          <CardDescription>
            Inicia sesion con tu cuenta de Google para participar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm />
        </CardContent>
      </Card>
    </div>
  )
}
