/**
 * Reset Password Page
 *
 * Password reset flow page.
 * Displays different UI based on whether user has reset token or not.
 */

'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PasswordResetForm } from '@/components/auth/PasswordResetForm'
import { Loader2 } from 'lucide-react'

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const [hasToken, setHasToken] = useState(false)

  useEffect(() => {
    // Check if we have a reset token in the URL
    const token = searchParams.get('token') || searchParams.get('access_token')
    setHasToken(!!token)
  }, [searchParams])

  return (
    <div className="container flex min-h-screen w-screen flex-col items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">
            {hasToken ? 'Set new password' : 'Reset password'}
          </CardTitle>
          <CardDescription>
            {hasToken
              ? 'Enter your new password below'
              : 'Enter your email address and we\'ll send you a reset link'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PasswordResetForm mode={hasToken ? 'update' : 'request'} />

          <div className="text-sm text-center">
            <Link href="/login" className="text-primary hover:underline">
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ResetPasswordLoading() {
  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordLoading />}>
      <ResetPasswordContent />
    </Suspense>
  )
}
