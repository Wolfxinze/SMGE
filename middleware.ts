/**
 * Next.js Middleware
 *
 * Handles route protection, session refresh, and authentication redirects.
 * Runs on every request before route handlers.
 *
 * Protected routes:
 * - /dashboard/* - Requires authentication
 * - /admin/* - Requires admin role
 * - /api/* (except auth routes) - Requires authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase/server'

// Routes that require authentication
const PROTECTED_ROUTES = ['/dashboard', '/settings', '/profile']
const ADMIN_ROUTES = ['/admin']
const API_PROTECTED = ['/api/brands', '/api/posts', '/api/analytics']

// Public routes that should redirect to dashboard if authenticated
const AUTH_ROUTES = ['/auth/signin', '/auth/signup']

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const pathname = request.nextUrl.pathname

  try {
    // Create Supabase client for middleware
    const supabase = createMiddlewareClient(request, response)

    // Refresh session if it exists
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) {
      console.error('Middleware session error:', sessionError)
    }

    // Check if path requires authentication
    const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route))
    const isAdminRoute = ADMIN_ROUTES.some(route => pathname.startsWith(route))
    const isProtectedAPI = API_PROTECTED.some(route => pathname.startsWith(route))
    const isAuthRoute = AUTH_ROUTES.some(route => pathname.startsWith(route))

    // Redirect authenticated users away from auth pages
    if (session && isAuthRoute) {
      const redirectUrl = new URL('/dashboard', request.url)
      return NextResponse.redirect(redirectUrl)
    }

    // Handle protected routes
    if (isProtectedRoute || isAdminRoute || isProtectedAPI) {
      if (!session) {
        // No session, redirect to sign in
        const redirectUrl = new URL('/auth/signin', request.url)
        redirectUrl.searchParams.set('next', pathname)
        return NextResponse.redirect(redirectUrl)
      }

      // For admin routes, verify admin role from JWT metadata
      if (isAdminRoute) {
        // Check role from JWT claims (no database query needed)
        // Role is stored in user_metadata during signup/profile update
        const userRole = session.user.user_metadata?.role || session.user.app_metadata?.role

        if (userRole !== 'admin') {
          // Not an admin, redirect to dashboard with error
          const redirectUrl = new URL('/dashboard', request.url)
          redirectUrl.searchParams.set('error', 'unauthorized')
          return NextResponse.redirect(redirectUrl)
        }
      }

      // For API routes, return 401 instead of redirecting
      if (isProtectedAPI && !session) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
    }

    // Add session status to response headers for client-side checks
    if (session) {
      response.headers.set('x-user-id', session.user.id)
      response.headers.set('x-session-expires', new Date(session.expires_at || '').toISOString())
    }

    return response
  } catch (error) {
    console.error('Middleware error:', error)
    // On error, allow request to proceed
    return response
  }
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, robots.txt (metadata files)
     * - public folder
     * - API routes that explicitly don't need auth (auth callbacks)
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|public|api/auth/callback|api/health).*)',
  ],
}