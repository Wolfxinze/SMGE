/**
 * useSession Hook
 *
 * Custom hook for managing user session state.
 * Provides reactive access to session data and refresh capabilities.
 *
 * Features:
 * - Real-time session state
 * - Manual session refresh
 * - Session expiry detection
 * - Automatic cleanup
 */

'use client'

import { useState, useEffect } from 'react'
import { Session } from '@supabase/supabase-js'
import { getSession, refreshSession, onAuthStateChange } from '@/lib/supabase/auth-client'

interface UseSessionReturn {
  session: Session | null
  loading: boolean
  error: Error | null
  refresh: () => Promise<void>
  isExpired: boolean
}

export function useSession(): UseSessionReturn {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // Get initial session
    getSession()
      .then((currentSession) => {
        setSession(currentSession)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error('Failed to get session'))
        setLoading(false)
      })

    // Listen for auth changes
    const unsubscribe = onAuthStateChange((event, newSession) => {
      setSession(newSession)
      setLoading(false)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const refresh = async () => {
    try {
      setLoading(true)
      setError(null)
      const newSession = await refreshSession()
      setSession(newSession)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to refresh session')
      setError(error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const isExpired = session
    ? new Date(session.expires_at! * 1000) < new Date()
    : false

  return {
    session,
    loading,
    error,
    refresh,
    isExpired,
  }
}
