/**
 * useAuth Hook
 *
 * Custom hook for managing authentication state and operations.
 * Provides reactive access to current user, loading states, and auth functions.
 *
 * Features:
 * - Real-time auth state synchronization
 * - Loading and error states
 * - Convenience methods for all auth operations
 * - Automatic cleanup on unmount
 */

'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { getClient } from '@/lib/supabase/client'
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithOAuth,
  signOut as authSignOut,
  sendPasswordResetEmail,
  updatePassword,
  updateProfile,
  onAuthStateChange,
} from '@/lib/supabase/auth-client'
import type { Provider } from '@supabase/supabase-js'

interface UseAuthReturn {
  user: User | null
  loading: boolean
  error: Error | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName?: string) => Promise<void>
  signInWithProvider: (provider: Provider) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updateUserPassword: (newPassword: string) => Promise<void>
  updateUserProfile: (updates: { full_name?: string; avatar_url?: string }) => Promise<void>
  clearError: () => void
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const supabase = getClient()

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const unsubscribe = onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const handleError = (err: unknown) => {
    const error = err instanceof Error ? err : new Error('An unknown error occurred')
    setError(error)
    throw error
  }

  const clearError = () => setError(null)

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      setError(null)
      await signInWithEmail(email, password)
    } catch (err) {
      handleError(err)
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      setLoading(true)
      setError(null)
      await signUpWithEmail(email, password, fullName ? { full_name: fullName } : undefined)
    } catch (err) {
      handleError(err)
    } finally {
      setLoading(false)
    }
  }

  const signInWithProvider = async (provider: Provider) => {
    try {
      setLoading(true)
      setError(null)
      await signInWithOAuth(provider)
    } catch (err) {
      handleError(err)
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      setError(null)
      await authSignOut()
      setUser(null)
    } catch (err) {
      handleError(err)
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (email: string) => {
    try {
      setLoading(true)
      setError(null)
      await sendPasswordResetEmail(email)
    } catch (err) {
      handleError(err)
    } finally {
      setLoading(false)
    }
  }

  const updateUserPassword = async (newPassword: string) => {
    try {
      setLoading(true)
      setError(null)
      await updatePassword(newPassword)
    } catch (err) {
      handleError(err)
    } finally {
      setLoading(false)
    }
  }

  const updateUserProfile = async (updates: { full_name?: string; avatar_url?: string }) => {
    try {
      setLoading(true)
      setError(null)
      await updateProfile(updates)
    } catch (err) {
      handleError(err)
    } finally {
      setLoading(false)
    }
  }

  return {
    user,
    loading,
    error,
    signIn,
    signUp,
    signInWithProvider,
    signOut,
    resetPassword,
    updateUserPassword,
    updateUserProfile,
    clearError,
  }
}
