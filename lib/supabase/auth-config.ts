/**
 * Supabase Auth Configuration
 *
 * This module provides helper functions and configuration for Supabase Auth,
 * including OAuth provider setup, callback URLs, and error handling.
 */

import { Provider } from '@supabase/supabase-js'

/**
 * OAuth Provider Configuration
 * Maps provider names to their configuration details
 */
export const OAUTH_PROVIDERS = {
  google: {
    name: 'google' as Provider,
    displayName: 'Google',
    icon: 'google', // Icon identifier for UI
    scopes: ['email', 'profile'],
    requiresBusinessAccount: false,
  },
  twitter: {
    name: 'twitter' as Provider,
    displayName: 'X (Twitter)',
    icon: 'twitter',
    scopes: ['tweet.read', 'tweet.write', 'users.read'],
    requiresBusinessAccount: false,
  },
  linkedin: {
    name: 'linkedin_oidc' as Provider, // LinkedIn uses OIDC variant
    displayName: 'LinkedIn',
    icon: 'linkedin',
    scopes: ['openid', 'profile', 'email', 'w_member_social'],
    requiresBusinessAccount: true, // LinkedIn requires app verification for posting
  },
  facebook: {
    name: 'facebook' as Provider,
    displayName: 'Facebook/Instagram',
    icon: 'facebook',
    scopes: [
      'email',
      'public_profile',
      'instagram_basic',
      'instagram_content_publish',
      'pages_show_list',
      'pages_read_engagement',
    ],
    requiresBusinessAccount: true, // Instagram requires business account
  },
} as const

export type OAuthProviderKey = keyof typeof OAUTH_PROVIDERS

/**
 * Auth Configuration
 */
export const AUTH_CONFIG = {
  // Redirect paths after authentication
  redirects: {
    success: process.env.NEXT_PUBLIC_AUTH_REDIRECT_TO || '/dashboard',
    error: process.env.NEXT_PUBLIC_AUTH_ERROR_REDIRECT || '/auth/error',
    emailConfirmation: '/auth/confirm-email',
    passwordReset: '/auth/reset-password',
  },

  // Session configuration
  session: {
    expiryTime: Number(process.env.SUPABASE_JWT_EXPIRY) || 3600, // 1 hour default
    refreshThreshold: 300, // Refresh token 5 minutes before expiry
  },

  // Email configuration
  email: {
    confirmationRequired:
      process.env.NEXT_PUBLIC_ENABLE_EMAIL_CONFIRMATION === 'true',
    magicLinkExpiry: Number(process.env.MAGIC_LINK_EXPIRY) || 3600,
  },

  // Feature flags
  features: {
    socialLogin: true,
    emailLogin: true,
    magicLink: true,
    phoneLogin: false, // Not implemented yet
  },
} as const

/**
 * Build callback URL for OAuth providers
 *
 * @param provider - OAuth provider key
 * @param redirectTo - Optional redirect path after successful auth
 * @returns Full callback URL with redirect parameter
 */
export function buildCallbackUrl(
  provider: OAuthProviderKey,
  redirectTo?: string
): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const callbackPath = '/auth/callback'

  const url = new URL(callbackPath, baseUrl)

  // Add provider parameter
  url.searchParams.set('provider', provider)

  // Add redirect parameter if specified
  if (redirectTo) {
    url.searchParams.set('redirect_to', redirectTo)
  }

  return url.toString()
}

/**
 * Build Supabase callback URL for provider configuration
 * This URL should be added to the OAuth app settings
 *
 * @param supabaseUrl - Supabase project URL
 * @returns Supabase callback URL for OAuth providers
 */
export function buildSupabaseCallbackUrl(supabaseUrl: string): string {
  return `${supabaseUrl}/auth/v1/callback`
}

/**
 * Get OAuth provider configuration
 *
 * @param provider - OAuth provider key
 * @returns Provider configuration object
 */
export function getProviderConfig(provider: OAuthProviderKey) {
  return OAUTH_PROVIDERS[provider]
}

/**
 * Build OAuth sign-in options
 *
 * @param provider - OAuth provider key
 * @param redirectTo - Optional redirect path after successful auth
 * @returns Options object for Supabase signInWithOAuth
 */
export function buildOAuthOptions(
  provider: OAuthProviderKey,
  redirectTo?: string
) {
  const config = getProviderConfig(provider)

  return {
    provider: config.name,
    options: {
      redirectTo: buildCallbackUrl(provider, redirectTo),
      scopes: config.scopes.join(' '),
      queryParams: {
        access_type: 'offline', // Request refresh token
        prompt: 'consent', // Always show consent screen
      },
    },
  }
}

/**
 * Auth Error Messages
 * User-friendly error messages for common auth errors
 */
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  // Supabase error codes
  'invalid_credentials': 'Invalid email or password. Please try again.',
  'user_not_found': 'No account found with this email address.',
  'email_not_confirmed': 'Please confirm your email address before signing in.',
  'invalid_grant': 'Authentication failed. Please try signing in again.',
  'user_already_exists': 'An account with this email already exists.',

  // OAuth errors
  'oauth_error': 'Authentication with social provider failed.',
  'oauth_cancelled': 'Sign-in was cancelled.',
  'oauth_permission_denied': 'Required permissions were not granted.',

  // Network errors
  'network_error': 'Network error. Please check your connection.',
  'server_error': 'Server error. Please try again later.',

  // Rate limiting
  'too_many_requests': 'Too many attempts. Please wait a moment and try again.',

  // Generic fallback
  'unknown_error': 'An unexpected error occurred. Please try again.',
}

/**
 * Get user-friendly error message
 *
 * @param error - Error object or error code
 * @returns User-friendly error message
 */
export function getAuthErrorMessage(error: any): string {
  // Handle Supabase auth errors
  if (error?.code && AUTH_ERROR_MESSAGES[error.code]) {
    return AUTH_ERROR_MESSAGES[error.code]
  }

  // Handle error message strings
  if (typeof error === 'string' && AUTH_ERROR_MESSAGES[error]) {
    return AUTH_ERROR_MESSAGES[error]
  }

  // Check for error message in error object
  if (error?.message) {
    // Check if message contains known error patterns
    for (const [key, message] of Object.entries(AUTH_ERROR_MESSAGES)) {
      if (error.message.toLowerCase().includes(key.toLowerCase())) {
        return message
      }
    }

    // Return raw message if it's user-friendly enough
    if (error.message.length < 100) {
      return error.message
    }
  }

  // Fallback to generic error
  return AUTH_ERROR_MESSAGES.unknown_error
}

/**
 * Validate email address format
 *
 * @param email - Email address to validate
 * @returns True if valid email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate password strength
 *
 * @param password - Password to validate
 * @returns Object with validation result and message
 */
export function validatePassword(password: string): {
  isValid: boolean
  message?: string
} {
  if (password.length < 8) {
    return {
      isValid: false,
      message: 'Password must be at least 8 characters long',
    }
  }

  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one uppercase letter',
    }
  }

  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one lowercase letter',
    }
  }

  if (!/[0-9]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one number',
    }
  }

  return { isValid: true }
}

/**
 * Check if a provider requires additional business account setup
 *
 * @param provider - OAuth provider key
 * @returns True if provider requires business account
 */
export function requiresBusinessAccount(provider: OAuthProviderKey): boolean {
  return OAUTH_PROVIDERS[provider].requiresBusinessAccount
}

/**
 * Get available OAuth providers
 *
 * @returns Array of available OAuth provider configurations
 */
export function getAvailableProviders() {
  // Return all configured OAuth providers
  // Note: In production, you might want to filter based on environment variables
  return Object.values(OAUTH_PROVIDERS)
}

/**
 * Session refresh helper
 * Determines if a session needs refreshing based on expiry time
 *
 * @param expiresAt - Session expiry timestamp (in seconds)
 * @returns True if session should be refreshed
 */
export function shouldRefreshSession(expiresAt: number): boolean {
  const now = Math.floor(Date.now() / 1000)
  const threshold = AUTH_CONFIG.session.refreshThreshold

  return (expiresAt - now) < threshold
}

/**
 * Format session duration for display
 *
 * @param seconds - Duration in seconds
 * @returns Human-readable duration string
 */
export function formatSessionDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} seconds`
  }

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`
  }

  const days = Math.floor(hours / 24)
  return `${days} day${days !== 1 ? 's' : ''}`
}