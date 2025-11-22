/**
 * Authentication Guards
 *
 * Server-side protection utilities for routes and server components.
 * Provides type-safe authentication and authorization helpers.
 */

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import {
  requireAuth as baseRequireAuth,
  requireAdmin as baseRequireAdmin,
  getUser,
  getSession,
  userHasRole
} from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

/**
 * Protection options
 */
export interface ProtectionOptions {
  redirectTo?: string
  role?: string
  allowedRoles?: string[]
  requireMFA?: boolean
  silent?: boolean // Don't throw/redirect, just return null
}

/**
 * Protected route wrapper for server components
 *
 * Ensures user is authenticated before rendering.
 * Redirects to sign in if not authenticated.
 *
 * @param options - Protection options
 * @returns Authenticated user or redirects
 */
export async function withAuth(
  options: ProtectionOptions = {}
): Promise<User | null> {
  const {
    redirectTo = '/auth/signin',
    silent = false
  } = options

  try {
    const user = await getUser()

    if (!user) {
      if (silent) {
        return null
      }

      // Get current path for redirect back
      const headersList = await headers()
      const pathname = headersList.get('x-pathname') || '/dashboard'
      const redirectUrl = `${redirectTo}?next=${encodeURIComponent(pathname)}`
      redirect(redirectUrl)
    }

    return user
  } catch (error) {
    console.error('Auth guard error:', error)
    if (!silent) {
      redirect(redirectTo)
    }
    return null
  }
}

/**
 * Protected route wrapper with role checking
 *
 * Ensures user is authenticated and has required role.
 *
 * @param role - Required role
 * @param options - Additional protection options
 * @returns Authenticated user with role or redirects
 */
export async function withRole(
  role: string,
  options: ProtectionOptions = {}
): Promise<User | null> {
  const {
    redirectTo = '/dashboard',
    silent = false
  } = options

  try {
    // First ensure authentication
    const user = await withAuth({ ...options, silent: true })

    if (!user) {
      if (silent) {
        return null
      }
      redirect('/auth/signin')
    }

    // Check role
    const hasRole = await userHasRole(user.id, role)

    if (!hasRole) {
      if (silent) {
        return null
      }
      redirect(`${redirectTo}?error=unauthorized`)
    }

    return user
  } catch (error) {
    console.error('Role guard error:', error)
    if (!silent) {
      redirect(redirectTo)
    }
    return null
  }
}

/**
 * Protected route wrapper for admin-only access
 *
 * Convenience wrapper for withRole('admin').
 *
 * @param options - Protection options
 * @returns Admin user or redirects
 */
export async function withAdmin(
  options: ProtectionOptions = {}
): Promise<User | null> {
  return withRole('admin', options)
}

/**
 * Check authentication without throwing
 *
 * Useful for conditional rendering in server components.
 *
 * @returns User if authenticated, null otherwise
 */
export async function checkAuth(): Promise<User | null> {
  try {
    return await getUser()
  } catch {
    return null
  }
}

/**
 * Check if current user has specific role
 *
 * @param role - Role to check
 * @returns Boolean indicating role membership
 */
export async function checkRole(role: string): Promise<boolean> {
  try {
    const user = await getUser()
    if (!user) {
      return false
    }
    return await userHasRole(user.id, role)
  } catch {
    return false
  }
}

/**
 * Server action guard
 *
 * Wraps server actions to ensure authentication.
 * Re-exports the base requireAuth for consistency.
 */
export const protectServerAction = baseRequireAuth

/**
 * Admin server action guard
 *
 * Wraps server actions to ensure admin access.
 * Re-exports the base requireAdmin for consistency.
 */
export const protectAdminAction = baseRequireAdmin

/**
 * Role-based server action guard
 *
 * Wraps server actions to ensure specific role.
 *
 * @param role - Required role
 * @returns Function that validates role before action
 */
export function protectRoleAction(role: string) {
  return async () => {
    const user = await baseRequireAuth()
    const hasRole = await userHasRole(user.id, role)

    if (!hasRole) {
      throw new Error(`Role '${role}' required`)
    }

    return user
  }
}

/**
 * Get protection context for server component
 *
 * Returns comprehensive auth state for conditional rendering.
 *
 * @returns Auth context
 */
export async function getAuthContext() {
  try {
    const session = await getSession()
    const user = session?.user || null

    if (!user) {
      return {
        authenticated: false,
        user: null,
        session: null,
        role: null,
        isAdmin: false,
      }
    }

    // Get user role from profiles
    const isAdmin = await userHasRole(user.id, 'admin')

    // Get actual role from database
    let userRole = 'user'
    if (isAdmin) {
      userRole = 'admin'
    }

    return {
      authenticated: true,
      user,
      session,
      role: userRole,
      isAdmin,
    }
  } catch (error) {
    console.error('Auth context error:', error)
    return {
      authenticated: false,
      user: null,
      session: null,
      role: null,
      isAdmin: false,
    }
  }
}

/**
 * Protect API route handler
 *
 * Wrapper for API route handlers that require authentication.
 *
 * @param handler - API route handler function
 * @param options - Protection options
 * @returns Protected handler
 */
export function withApiAuth<T extends (...args: any[]) => any>(
  handler: T,
  options: ProtectionOptions = {}
): T {
  return (async (...args: Parameters<T>) => {
    try {
      const user = await getUser()

      if (!user) {
        return Response.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }

      // Check role if specified
      if (options.role) {
        const hasRole = await userHasRole(user.id, options.role)
        if (!hasRole) {
          return Response.json(
            { error: 'Insufficient permissions' },
            { status: 403 }
          )
        }
      }

      // Check multiple allowed roles
      if (options.allowedRoles && options.allowedRoles.length > 0) {
        let hasAnyRole = false
        for (const role of options.allowedRoles) {
          if (await userHasRole(user.id, role)) {
            hasAnyRole = true
            break
          }
        }
        if (!hasAnyRole) {
          return Response.json(
            { error: 'Insufficient permissions' },
            { status: 403 }
          )
        }
      }

      // Call the actual handler
      return handler(...args)
    } catch (error) {
      console.error('API auth guard error:', error)
      return Response.json(
        { error: 'Authentication error' },
        { status: 500 }
      )
    }
  }) as T
}