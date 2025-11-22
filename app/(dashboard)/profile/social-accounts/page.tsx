/**
 * Social Accounts Page
 *
 * Manage connected social media accounts.
 * Connect/disconnect OAuth providers for posting and content management.
 */

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { withAuth } from '@/lib/auth/protected'
import { SocialAccountsManager } from '@/components/profile/SocialAccountsManager'
import { Loader2 } from 'lucide-react'

export const metadata = {
  title: 'Social Accounts | SMGE',
  description: 'Manage your connected social media accounts',
}

async function SocialAccountsContent() {
  // Ensure user is authenticated
  const user = await withAuth()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Social Accounts</h1>
          <p className="text-muted-foreground mt-2">
            Connect your social media accounts to manage content and schedule posts
          </p>
        </div>

        <SocialAccountsManager userId={user.id} />
      </div>
    </div>
  )
}

function SocialAccountsLoading() {
  return (
    <div className="container max-w-4xl py-8 flex justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

export default function SocialAccountsPage() {
  return (
    <Suspense fallback={<SocialAccountsLoading />}>
      <SocialAccountsContent />
    </Suspense>
  )
}
