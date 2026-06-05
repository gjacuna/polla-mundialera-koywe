import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function SignUpPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (session?.user) {
    redirect('/')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-8 flex items-center gap-3">
        <img src="/icon.svg" alt="Koywe" className="h-12 w-12 rounded-xl" />
        <span className="text-2xl font-bold">Prediction Markets</span>
        <img src="/koywe-logo.svg" alt="Koywe" className="mt-1.5 h-7" />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Unete a Prediction Markets</CardTitle>
          <CardDescription>
            Registrate con tu cuenta de Google para participar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm />
        </CardContent>
      </Card>
    </div>
  )
}
