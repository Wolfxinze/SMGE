/**
 * SocialAccountsManager Component
 *
 * Manages all connected social media accounts.
 * Fetches account data and handles connect/disconnect operations.
 */

'use client'

import { useEffect, useState } from 'react'
import { SocialAccountCard, type SocialAccount } from './SocialAccountCard'
import { Alert } from '@/components/ui/alert'
import { signInWithOAuth } from '@/lib/supabase/auth-client'
import { getClient } from '@/lib/supabase/client'
import { Loader2, AlertCircle } from 'lucide-react'
import type { Provider } from '@supabase/supabase-js'

interface SocialAccountsManagerProps {
  userId: string
}

export function SocialAccountsManager({ userId }: SocialAccountsManagerProps) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAccounts()
  }, [userId])

  const loadAccounts = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const supabase = getClient()

      // Fetch social_accounts from database
      const { data, error: fetchError } = await supabase
        .from('social_accounts')
        .select('*')
        .eq('user_id', userId)

      if (fetchError) throw fetchError

      // Create account list with all providers
      const providers: Array<'twitter' | 'linkedin_oidc' | 'instagram' | 'google'> = [
        'twitter',
        'linkedin_oidc',
        'instagram',
        'google',
      ]

      const accountList: SocialAccount[] = providers.map((provider) => {
        // Map OAuth provider names to platform names in database
        const platformMap: Record<string, string> = {
          'twitter': 'twitter',
          'linkedin_oidc': 'linkedin',
          'instagram': 'instagram',
          'google': 'google',
        }
        const platform = platformMap[provider]
        const account = data?.find((a: any) => a.platform === platform) as any

        return {
          provider,
          connected: !!account,
          profile_name: account?.account_name as string | undefined,
          profile_url: undefined,
          profile_image: undefined,
          connected_at: account?.created_at as string | undefined,
        }
      })

      setAccounts(accountList)
    } catch (err) {
      console.error('Error loading accounts:', err)
      setError(err instanceof Error ? err.message : 'Failed to load accounts')
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnect = async (provider: string) => {
    try {
      // Initiate OAuth flow
      await signInWithOAuth(provider as Provider)
      // The redirect will happen automatically
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to connect account')
    }
  }

  const handleDisconnect = async (provider: string) => {
    try {
      const supabase = getClient()

      // Map OAuth provider to platform name
      const platformMap: Record<string, string> = {
        'twitter': 'twitter',
        'linkedin_oidc': 'linkedin',
        'instagram': 'instagram',
        'google': 'google',
      }
      const platform = platformMap[provider]

      // Delete the social account
      const { error: deleteError } = await supabase
        .from('social_accounts')
        .delete()
        .eq('user_id', userId)
        .eq('platform', platform)

      if (deleteError) throw deleteError

      // Reload accounts
      await loadAccounts()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to disconnect account')
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <div className="ml-2">{error}</div>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {accounts.map((account) => (
        <SocialAccountCard
          key={account.provider}
          account={account}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />
      ))}
    </div>
  )
}
