/**
 * ProfileForm Component
 *
 * Form for editing user profile information.
 * Includes validation, avatar upload, and optimistic updates.
 */

'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { Loader2, AlertCircle, CheckCircle2, User } from 'lucide-react'

const profileSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
  email: z.string().email('Invalid email address'),
  avatar_url: z.string().url('Invalid URL').optional().or(z.literal('')),
})

type ProfileFormData = z.infer<typeof profileSchema>

interface ProfileFormProps {
  initialData?: {
    full_name?: string
    email?: string
    avatar_url?: string
  }
  onSuccess?: () => void
}

export function ProfileForm({ initialData, onSuccess }: ProfileFormProps) {
  const router = useRouter()
  const { user, updateUserProfile } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: initialData?.full_name || user?.user_metadata?.full_name || '',
      email: initialData?.email || user?.email || '',
      avatar_url: initialData?.avatar_url || user?.user_metadata?.avatar_url || '',
    },
  })

  const onSubmit = async (data: ProfileFormData) => {
    try {
      setIsLoading(true)
      setError(null)
      setSuccess(false)

      // Only update profile metadata (email update requires separate flow)
      await updateUserProfile({
        full_name: data.full_name,
        avatar_url: data.avatar_url || undefined,
      })

      setSuccess(true)

      if (onSuccess) {
        onSuccess()
      }

      // Refresh the page to show updated data
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>
          Update your personal information and profile settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <div className="ml-2">{error}</div>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <div className="ml-2 text-green-800">
                Profile updated successfully!
              </div>
            </Alert>
          )}

          <div className="space-y-4">
            {/* Avatar Preview */}
            <div className="flex items-center space-x-4">
              <div className="relative h-20 w-20 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                {user?.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor="avatar_url">Avatar URL</Label>
                <Input
                  id="avatar_url"
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  disabled={isLoading}
                  {...register('avatar_url')}
                />
                {errors.avatar_url && (
                  <p className="text-sm text-red-600">{errors.avatar_url.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Enter a URL to your profile picture
                </p>
              </div>
            </div>

            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                type="text"
                placeholder="John Doe"
                disabled={isLoading}
                {...register('full_name')}
                aria-describedby="full_name-error"
              />
              {errors.full_name && (
                <p id="full_name-error" className="text-sm text-red-600">
                  {errors.full_name.message}
                </p>
              )}
            </div>

            {/* Email (read-only) */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                disabled
                {...register('email')}
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed from this form. Contact support to change your email.
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !isDirty}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
