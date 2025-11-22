/**
 * Supabase Server Configuration
 *
 * Server-side Supabase clients for use in API routes, server components, and middleware.
 * Implements proper cookie handling for SSR and provides both public and admin clients.
 *
 * Security considerations:
 * - Service role key must NEVER be exposed to client
 * - Always validate user permissions before using service role client
 * - Use public client by default, service role only when necessary
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/types/supabase'

/**
 * Environment variable validation
 */
function getEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Optional for now

/**
 * Creates a Supabase client for server-side usage with anon key
 *
 * This client respects Row Level Security (RLS) policies.
 * Use this for most server-side operations.
 *
 * @returns Configured Supabase client with cookie-based auth
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Cookie setting can fail in some contexts (e.g., after response sent)
            // This is expected in some server component scenarios
          }
        },
      },
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // Not needed server-side
      },
      global: {
        // Server-side fetch doesn't need timeout handling
        fetch: fetch,
      },
      db: {
        schema: 'public',
      },
    }
  )
}

/**
 * Creates a Supabase client with service role key (admin access)
 *
 * WARNING: This client bypasses ALL Row Level Security policies.
 * Only use for:
 * - System-level operations
 * - Background jobs
 * - Admin operations after proper authorization
 *
 * @returns Admin Supabase client with full database access
 */
export function createServiceClient() {
  if (!supabaseServiceKey) {
    throw new Error(
      'Missing environment variable: SUPABASE_SERVICE_ROLE_KEY. ' +
      'This is required for admin operations.'
    )
  }

  return createServerClient<Database>(
    supabaseUrl,
    supabaseServiceKey,
    {
      cookies: {
        // Service role client doesn't need cookie handling
        getAll() {
          return []
        },
        setAll() {
          // No-op for service role
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: fetch,
      },
      db: {
        schema: 'public',
      },
    }
  )
}

/**
 * Creates a Supabase client for use in Next.js middleware
 *
 * Handles cookie operations in the middleware context where
 * the cookies API works differently than in server components.
 *
 * @param request - The incoming request
 * @param response - The response being built
 * @returns Supabase client configured for middleware
 */
export function createMiddlewareClient(
  request: NextRequest,
  response: NextResponse
) {
  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({ name, value, ...options })
            response.cookies.set({ name, value, ...options })
          })
        },
      },
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    }
  )
}

/**
 * Helper function to get session from server
 *
 * @returns User session or null
 */
export async function getSession() {
  const supabase = await createClient()

  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw error
    return session
  } catch (error) {
    console.error('Error fetching session:', error)
    return null
  }
}

/**
 * Helper function to get user from server
 *
 * @returns User object or null
 */
export async function getUser() {
  const supabase = await createClient()

  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) throw error
    return user
  } catch (error) {
    console.error('Error fetching user:', error)
    return null
  }
}

/**
 * Helper function to verify user has specific role
 *
 * @param userId - User ID to check
 * @param role - Required role
 * @returns Boolean indicating if user has role
 */
export async function userHasRole(userId: string, role: string): Promise<boolean> {
  const supabase = createServiceClient()

  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', role)
      .single()

    return !error && data !== null
  } catch {
    return false
  }
}

/**
 * Helper function to enforce authentication in server actions
 *
 * @throws Error if user is not authenticated
 * @returns Authenticated user object
 */
export async function requireAuth() {
  const user = await getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  return user
}

/**
 * Helper function to enforce admin role in server actions
 *
 * @throws Error if user is not an admin
 * @returns Authenticated admin user object
 */
export async function requireAdmin() {
  const user = await requireAuth()

  const isAdmin = await userHasRole(user.id, 'admin')
  if (!isAdmin) {
    throw new Error('Admin access required')
  }

  return user
}