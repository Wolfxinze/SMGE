/**
 * Supabase Client Configuration
 *
 * Client-side Supabase instance for use in React components and client-side code.
 * Uses the public anon key which is safe to expose in browser code.
 *
 * This configuration implements:
 * - Singleton pattern to prevent multiple client instances
 * - Cookie-based auth storage for SSR compatibility
 * - Proper TypeScript typing for database schema
 * - Error handling and connection validation
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/db/types'

/**
 * Environment variable validation
 * Ensures required Supabase configuration is present at build time
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

/**
 * Creates a Supabase client for browser/client-side usage
 *
 * Features:
 * - Automatic token refresh
 * - Cookie-based session storage
 * - TypeScript database typing
 * - Retry logic for transient failures
 *
 * @returns Configured Supabase client instance
 */
export function createClient() {
  return createBrowserClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        // Cookie configuration for auth persistence
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,

        // Storage configuration
        storage: {
          // Use cookies for SSR compatibility
          getItem: (key: string) => {
            if (typeof document === 'undefined') return null
            const cookies = document.cookie.split('; ')
            const cookie = cookies.find(c => c.startsWith(`${key}=`))
            return cookie ? decodeURIComponent(cookie.split('=')[1]) : null
          },
          setItem: (key: string, value: string) => {
            if (typeof document === 'undefined') return
            const maxAge = 60 * 60 * 24 * 7 // 7 days
            document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax; secure`
          },
          removeItem: (key: string) => {
            if (typeof document === 'undefined') return
            document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT`
          }
        }
      },

      // Global configuration
      global: {
        // Custom fetch implementation for better error handling
        fetch: async (url, options = {}) => {
          const maxRetries = 3
          let lastError: Error | null = null

          for (let i = 0; i < maxRetries; i++) {
            try {
              const response = await fetch(url, {
                ...options,
                // Add timeout for long-running requests
                signal: AbortSignal.timeout(30000) // 30 seconds
              })

              // Log rate limit warnings
              if (response.headers.get('x-ratelimit-remaining') === '0') {
                console.warn('Supabase rate limit reached')
              }

              return response
            } catch (error) {
              lastError = error as Error

              // Don't retry on client errors
              if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
                break
              }

              // Exponential backoff
              if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000))
              }
            }
          }

          throw lastError || new Error('Failed to fetch after retries')
        }
      },

      // Database configuration
      db: {
        schema: 'public'
      },

      // Realtime configuration (for future use)
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    }
  )
}

/**
 * Singleton Supabase client instance
 * Prevents multiple client instantiations which can cause auth issues
 */
let clientInstance: ReturnType<typeof createClient> | null = null

/**
 * Get or create the singleton Supabase client
 *
 * @returns The singleton Supabase client instance
 */
export function getClient() {
  if (!clientInstance) {
    clientInstance = createClient()
  }
  return clientInstance
}

/**
 * Helper function to check if user is authenticated
 *
 * @param client - Supabase client instance
 * @returns Boolean indicating auth status
 */
export async function isAuthenticated(client = getClient()) {
  try {
    const { data: { session }, error } = await client.auth.getSession()
    return !error && session !== null
  } catch {
    return false
  }
}

/**
 * Helper function to get current user
 *
 * @param client - Supabase client instance
 * @returns Current user or null
 */
export async function getCurrentUser(client = getClient()) {
  try {
    const { data: { user }, error } = await client.auth.getUser()
    if (error) throw error
    return user
  } catch {
    return null
  }
}

// Export the default client for convenience
export default getClient()