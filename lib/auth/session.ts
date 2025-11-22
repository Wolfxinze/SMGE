/**
 * Session Management Utilities
 *
 * Provides server-side session management functions for
 * authentication state, refresh logic, and validation.
 */

import { createClient } from '@/lib/supabase/server'
import type { Session, User } from '@supabase/supabase-js'

/**
 * Session validation result
 */
export interface SessionValidation {
  valid: boolean
  session: Session | null
  user: User | null
  error?: string
  needsRefresh?: boolean
}

/**
 * Validates the current session
 *
 * Checks if session exists and is still valid.
 * Indicates if session needs refreshing.
 *
 * @returns Session validation result
 */
export async function validateSession(): Promise<SessionValidation> {
  try {
    const supabase = await createClient()
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
      return {
        valid: false,
        session: null,
        user: null,
        error: error.message,
      }
    }

    if (!session) {
      return {
        valid: false,
        session: null,
        user: null,
        error: 'No active session',
      }
    }

    // Check if session is expired or needs refresh
    const expiresAt = new Date(session.expires_at || 0).getTime()
    const now = Date.now()
    const expiresIn = expiresAt - now

    // Session expired
    if (expiresIn <= 0) {
      return {
        valid: false,
        session: null,
        user: null,
        error: 'Session expired',
      }
    }

    // Session needs refresh if expires in less than 60 seconds
    const needsRefresh = expiresIn < 60000

    return {
      valid: true,
      session,
      user: session.user,
      needsRefresh,
    }
  } catch (error) {
    console.error('Session validation error:', error)
    return {
      valid: false,
      session: null,
      user: null,
      error: 'Session validation failed',
    }
  }
}

/**
 * Refreshes the current session
 *
 * Attempts to refresh the session token if valid refresh token exists.
 *
 * @returns New session or null
 */
export async function refreshSession(): Promise<Session | null> {
  try {
    const supabase = await createClient()

    // Get current session first
    const { data: { session: currentSession } } = await supabase.auth.getSession()

    if (!currentSession) {
      return null
    }

    // Attempt to refresh
    const { data: { session }, error } = await supabase.auth.refreshSession()

    if (error) {
      console.error('Session refresh error:', error)
      return null
    }

    return session
  } catch (error) {
    console.error('Unexpected error refreshing session:', error)
    return null
  }
}

/**
 * Gets session with automatic refresh if needed
 *
 * @returns Valid session or null
 */
export async function getValidSession(): Promise<Session | null> {
  const validation = await validateSession()

  if (!validation.valid) {
    return null
  }

  if (validation.needsRefresh) {
    const refreshed = await refreshSession()
    return refreshed || validation.session
  }

  return validation.session
}

/**
 * Destroys the current session
 *
 * Signs out the user and clears all session data.
 *
 * @returns Success boolean
 */
export async function destroySession(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Sign out error:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Unexpected error destroying session:', error)
    return false
  }
}

/**
 * Gets session metadata
 *
 * Returns useful session information for debugging and monitoring.
 *
 * @returns Session metadata
 */
export async function getSessionMetadata() {
  const validation = await validateSession()

  if (!validation.valid || !validation.session) {
    return null
  }

  const session = validation.session
  const expiresAt = new Date(session.expires_at || 0)
  const now = new Date()
  const expiresIn = Math.floor((expiresAt.getTime() - now.getTime()) / 1000)

  return {
    userId: session.user.id,
    email: session.user.email,
    provider: session.user.app_metadata?.provider || 'email',
    expiresAt: expiresAt.toISOString(),
    expiresIn: `${expiresIn} seconds`,
    needsRefresh: validation.needsRefresh || false,
    factors: session.user.factors?.map(f => f.factor_type) || [],
  }
}

/**
 * Checks if user has MFA enabled
 *
 * @returns Boolean indicating MFA status
 */
export async function hasMFAEnabled(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return false
    }

    // Check if user has any enrolled factors
    const factors = user.factors || []
    return factors.some(factor => factor.status === 'verified')
  } catch (error) {
    console.error('MFA check error:', error)
    return false
  }
}

/**
 * Gets the current authentication level
 *
 * @returns AAL level (aal1 or aal2)
 */
export async function getAuthenticationLevel(): Promise<'aal1' | 'aal2' | null> {
  const validation = await validateSession()

  if (!validation.valid || !validation.session) {
    return null
  }

  // Check if user has MFA factors verified
  const hasMFA = validation.session.user.factors?.some(f => f.status === 'verified') || false
  return hasMFA ? 'aal2' : 'aal1'
}

/**
 * Checks if session has required authentication level
 *
 * @param requiredLevel - Required AAL level
 * @returns Boolean indicating if requirement is met
 */
export async function hasRequiredAuthLevel(requiredLevel: 'aal1' | 'aal2'): Promise<boolean> {
  const currentLevel = await getAuthenticationLevel()

  if (!currentLevel) {
    return false
  }

  // aal2 satisfies both aal2 and aal1 requirements
  if (currentLevel === 'aal2') {
    return true
  }

  // aal1 only satisfies aal1 requirement
  return requiredLevel === 'aal1'
}