/**
 * SocialAccountCard Component
 *
 * Displays connected social media accounts with connect/disconnect actions.
 * Shows account status, profile info, and allows management.
 */

'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Twitter,
  Linkedin,
  Instagram,
  ExternalLink
} from 'lucide-react'

export interface SocialAccount {
  provider: 'twitter' | 'linkedin_oidc' | 'instagram' | 'google'
  connected: boolean
  profile_name?: string
  profile_url?: string
  profile_image?: string
  connected_at?: string
}

interface SocialAccountCardProps {
  account: SocialAccount
  onConnect?: (provider: string) => Promise<void>
  onDisconnect?: (provider: string) => Promise<void>
}

const providerConfig = {
  twitter: {
    name: 'Twitter / X',
    icon: Twitter,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
  },
  linkedin_oidc: {
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
  },
  instagram: {
    name: 'Instagram',
    icon: Instagram,
    color: 'text-pink-500',
    bgColor: 'bg-pink-50',
  },
  google: {
    name: 'Google',
    icon: ExternalLink,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
  },
}

export function SocialAccountCard({
  account,
  onConnect,
  onDisconnect,
}: SocialAccountCardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const config = providerConfig[account.provider]
  const Icon = config.icon

  const handleConnect = async () => {
    if (!onConnect) return

    try {
      setIsLoading(true)
      setError(null)
      await onConnect(account.provider)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisconnect = async () => {
    if (!onDisconnect) return

    if (!confirm(`Are you sure you want to disconnect your ${config.name} account?`)) {
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      await onDisconnect(account.provider)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4 flex-1">
            {/* Provider Icon */}
            <div className={`rounded-lg p-3 ${config.bgColor}`}>
              <Icon className={`h-6 w-6 ${config.color}`} />
            </div>

            {/* Account Info */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-lg">{config.name}</h3>
                {account.connected ? (
                  <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <XCircle className="h-3 w-3 mr-1" />
                    Not Connected
                  </Badge>
                )}
              </div>

              {account.connected && account.profile_name && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Connected as: <span className="font-medium text-foreground">{account.profile_name}</span>
                  </p>
                  {account.connected_at && (
                    <p className="text-xs text-muted-foreground">
                      Connected {new Date(account.connected_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

              {!account.connected && (
                <p className="text-sm text-muted-foreground">
                  Connect your {config.name} account to post and manage content
                </p>
              )}

              {error && (
                <Alert variant="destructive" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <div className="ml-2 text-sm">{error}</div>
                </Alert>
              )}
            </div>
          </div>

          {/* Action Button */}
          <div className="ml-4">
            {account.connected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </>
                ) : (
                  'Disconnect'
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleConnect}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect'
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
