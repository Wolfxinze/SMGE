/**
 * Profile Page
 *
 * User profile management page.
 * Allows users to edit their profile information.
 */

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { withAuth } from '@/lib/auth/protected'
import { ProfileForm } from '@/components/profile/ProfileForm'
import { Loader2 } from 'lucide-react'

export const metadata = {
  title: 'Profile | SMGE',
  description: 'Manage your profile settings',
}

async function ProfilePageContent() {
  // Ensure user is authenticated
  const user = await withAuth()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your account information and preferences
          </p>
        </div>

        <ProfileForm
          initialData={{
            full_name: user.user_metadata?.full_name,
            email: user.email,
            avatar_url: user.user_metadata?.avatar_url,
          }}
        />
      </div>
    </div>
  )
}

function ProfileLoading() {
  return (
    <div className="container max-w-4xl py-8 flex justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileLoading />}>
      <ProfilePageContent />
    </Suspense>
  )
}
