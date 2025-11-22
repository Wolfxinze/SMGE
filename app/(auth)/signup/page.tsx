/**
 * Signup Page
 *
 * User registration page with email/password and OAuth options.
 * Redirects to verify-email page after successful registration.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { SignupForm } from '@/components/auth/SignupForm'
import { OAuthButtons } from '@/components/auth/OAuthButtons'
import { Loader2 } from 'lucide-react'

export const metadata = {
  title: 'Sign Up | SMGE',
  description: 'Create your SMGE account',
}

function SignupPageContent() {
  return (
    <div className="container flex min-h-screen w-screen flex-col items-center justify-center py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">
            Create an account
          </CardTitle>
          <CardDescription>
            Get started with SMGE to grow your social media presence
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

          <SignupForm />
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <p className="text-xs text-center text-muted-foreground">
            By signing up, you agree to our{' '}
            <Link href="/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
          </p>
          <div className="text-sm text-center text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

function SignupLoading() {
  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupLoading />}>
      <SignupPageContent />
    </Suspense>
  )
}
