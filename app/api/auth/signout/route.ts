/**
 * Sign Out Route Handler
 *
 * Handles user sign out by clearing the session and redirecting.
 * Supports both GET and POST methods for flexibility.
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function handleSignOut(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const redirectTo = requestUrl.searchParams.get('redirectTo') ?? '/'

  try {
    const supabase = await createClient()

    // Sign out the user
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Sign out error:', error)
      // Continue with redirect even if sign out fails
      // The session will expire naturally
    }

    // Ensure redirect path is relative to prevent open redirects
    const safeRedirectTo = redirectTo.startsWith('/') ? redirectTo : '/'

    // Create response with redirect
    const response = NextResponse.redirect(new URL(safeRedirectTo, requestUrl.origin))

    // Clear any custom session cookies if they exist
    response.cookies.delete('sb-access-token')
    response.cookies.delete('sb-refresh-token')

    return response
  } catch (error) {
    console.error('Unexpected error during sign out:', error)
    // Redirect to home page on error
    return NextResponse.redirect(new URL('/', requestUrl.origin))
  }
}

// Support both GET and POST methods
export async function GET(request: NextRequest) {
  return handleSignOut(request)
}

export async function POST(request: NextRequest) {
  return handleSignOut(request)
}