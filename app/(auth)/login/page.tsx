/**
 * Login Page
 *
 * User authentication page with email/password and OAuth options.
 * Handles redirect after successful login.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { LoginForm } from '@/components/auth/LoginForm'
import { OAuthButtons } from '@/components/auth/OAuthButtons'
import { Loader2 } from 'lucide-react'

export const metadata = {
  title: 'Sign In | SMGE',
  description: 'Sign in to your SMGE account',
}

function LoginPageContent() {
  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">
            Welcome back
          </CardTitle>
          <CardDescription>
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <OAuthButtons />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <LoginForm />
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center w-full space-y-2">
            <Link
              href="/reset-password"
              className="text-primary hover:underline block"
            >
              Forgot your password?
            </Link>
            <div className="text-muted-foreground">
              Don't have an account?{' '}
              <Link href="/signup" className="text-primary hover:underline">
                Sign up
              </Link>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

function LoginLoading() {
  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginPageContent />
    </Suspense>
  )
}
