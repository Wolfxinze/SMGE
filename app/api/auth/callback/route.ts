/**
 * OAuth Callback Route Handler
 *
 * Handles OAuth provider callbacks for authentication flow.
 * Exchanges authorization code for session and redirects user.
 *
 * Flow:
 * 1. Receive callback from OAuth provider with code
 * 2. Exchange code for Supabase session
 * 3. Redirect to dashboard or handle errors
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')

  // Handle OAuth errors from provider
  if (error) {
    console.error('OAuth callback error:', error, errorDescription)
    return NextResponse.redirect(
      new URL(`/auth/signin?error=${encodeURIComponent(errorDescription || error)}`, requestUrl.origin)
    )
  }

  if (code) {
    try {
      const supabase = await createClient()

      // Exchange code for session
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      if (exchangeError) {
        console.error('Code exchange error:', exchangeError)
        return NextResponse.redirect(
          new URL(`/auth/signin?error=${encodeURIComponent('Authentication failed. Please try again.')}`, requestUrl.origin)
        )
      }

      // Verify session was created
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session) {
        console.error('Session verification failed:', sessionError)
        return NextResponse.redirect(
          new URL('/auth/signin?error=Session+creation+failed', requestUrl.origin)
        )
      }

      // Check if user profile exists
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, onboarding_completed')
        .eq('id', session.user.id)
        .single()

      if (profileError && profileError.code !== 'PGRST116') {
        // PGRST116 = row not found, which is expected for new users
        console.error('Profile fetch error:', profileError)
      }

      // Determine redirect based on profile state
      let redirectTo = next
      if (!profile) {
        // New user, might need onboarding
        redirectTo = '/onboarding'
      } else if (profile.onboarding_completed === false) {
        // Existing user who hasn't completed onboarding
        redirectTo = '/onboarding'
      }

      // Ensure redirect path is relative to prevent open redirects
      if (!redirectTo.startsWith('/')) {
        redirectTo = '/dashboard'
      }

      return NextResponse.redirect(new URL(redirectTo, requestUrl.origin))
    } catch (error) {
      console.error('Unexpected error in OAuth callback:', error)
      return NextResponse.redirect(
        new URL('/auth/signin?error=An+unexpected+error+occurred', requestUrl.origin)
      )
    }
  }

  // No code parameter present
  return NextResponse.redirect(
    new URL('/auth/signin?error=No+authorization+code+received', requestUrl.origin)
  )
}