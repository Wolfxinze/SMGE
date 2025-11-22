/**
 * Client-side Authentication Utilities
 *
 * Provides helper functions for authentication operations in client components.
 * Uses the existing Supabase client singleton from lib/supabase/client.ts
 *
 * Features:
 * - Email/password authentication
 * - OAuth provider authentication
 * - Password reset flow
 * - Session management
 * - User profile operations
 */

import { getClient } from './client'
import type { Provider } from '@supabase/supabase-js'

/**
 * Sign in with email and password
 *
 * @param email - User email
 * @param password - User password
 * @returns Auth response with user and session
 */
export async function signInWithEmail(email: string, password: string) {
  const supabase = getClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error
  return data
}

/**
 * Sign up with email and password
 *
 * @param email - User email
 * @param password - User password
 * @param metadata - Optional user metadata
 * @returns Auth response with user and session
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  metadata?: { full_name?: string }
) {
  const supabase = getClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  })

  if (error) throw error
  return data
}

/**
 * Sign in with OAuth provider
 *
 * @param provider - OAuth provider (google, twitter, linkedin, etc.)
 * @returns Auth response
 */
export async function signInWithOAuth(provider: Provider) {
  const supabase = getClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  if (error) throw error
  return data
}

/**
 * Sign out current user
 *
 * @returns Void on success
 */
export async function signOut() {
  const supabase = getClient()

  const { error } = await supabase.auth.signOut()

  if (error) throw error
}

/**
 * Send password reset email
 *
 * @param email - User email
 * @returns Void on success
 */
export async function sendPasswordResetEmail(email: string) {
  const supabase = getClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  })

  if (error) throw error
}

/**
 * Update user password
 *
 * @param newPassword - New password
 * @returns User data on success
 */
export async function updatePassword(newPassword: string) {
  const supabase = getClient()

  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) throw error
  return data
}

/**
 * Update user profile metadata
 *
 * @param updates - Profile updates
 * @returns User data on success
 */
export async function updateProfile(updates: {
  full_name?: string
  avatar_url?: string
}) {
  const supabase = getClient()

  const { data, error } = await supabase.auth.updateUser({
    data: updates,
  })

  if (error) throw error
  return data
}

/**
 * Resend verification email
 *
 * @param email - User email
 * @returns Void on success
 */
export async function resendVerificationEmail(email: string) {
  const supabase = getClient()

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  })

  if (error) throw error
}

/**
 * Get current session
 *
 * @returns Session or null
 */
export async function getSession() {
  const supabase = getClient()

  const { data: { session }, error } = await supabase.auth.getSession()

  if (error) throw error
  return session
}

/**
 * Refresh current session
 *
 * @returns Refreshed session
 */
export async function refreshSession() {
  const supabase = getClient()

  const { data, error } = await supabase.auth.refreshSession()

  if (error) throw error
  return data.session
}

/**
 * Subscribe to auth state changes
 *
 * @param callback - Callback function for auth state changes
 * @returns Unsubscribe function
 */
export function onAuthStateChange(
  callback: (event: string, session: any) => void
) {
  const supabase = getClient()

  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback)

  return () => subscription.unsubscribe()
}
