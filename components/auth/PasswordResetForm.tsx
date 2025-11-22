/**
 * PasswordResetForm Component
 *
 * Form for password reset functionality.
 * Supports both requesting reset email and setting new password.
 */

'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import { useAuth } from '@/hooks/useAuth'
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react'

const requestResetSchema = z.object({
  email: z.string().email('Invalid email address'),
})

const updatePasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type RequestResetFormData = z.infer<typeof requestResetSchema>
type UpdatePasswordFormData = z.infer<typeof updatePasswordSchema>

interface PasswordResetFormProps {
  mode?: 'request' | 'update'
  onSuccess?: () => void
}

export function PasswordResetForm({
  mode = 'request',
  onSuccess,
}: PasswordResetFormProps) {
  const { resetPassword, updateUserPassword } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const requestForm = useForm<RequestResetFormData>({
    resolver: zodResolver(requestResetSchema),
  })

  const updateForm = useForm<UpdatePasswordFormData>({
    resolver: zodResolver(updatePasswordSchema),
  })

  const onRequestReset = async (data: RequestResetFormData) => {
    try {
      setIsLoading(true)
      setError(null)

      await resetPassword(data.email)

      setSuccess(true)

      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email')
    } finally {
      setIsLoading(false)
    }
  }

  const onUpdatePassword = async (data: UpdatePasswordFormData) => {
    try {
      setIsLoading(true)
      setError(null)

      await updateUserPassword(data.password)

      setSuccess(true)

      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <Alert className="border-green-500 text-green-700 bg-green-50">
        <CheckCircle className="h-4 w-4" />
        <div className="ml-2">
          <p className="font-semibold">
            {mode === 'request' ? 'Reset email sent!' : 'Password updated!'}
          </p>
          <p className="text-sm mt-1">
            {mode === 'request'
              ? 'Check your email for password reset instructions.'
              : 'Your password has been successfully updated.'
            }
          </p>
        </div>
      </Alert>
    )
  }

  if (mode === 'request') {
    return (
      <form onSubmit={requestForm.handleSubmit(onRequestReset)} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <div className="ml-2">{error}</div>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            disabled={isLoading}
            {...requestForm.register('email')}
          />
          {requestForm.formState.errors.email && (
            <p className="text-sm text-red-600">
              {requestForm.formState.errors.email.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            'Send reset email'
          )}
        </Button>
      </form>
    )
  }

  return (
    <form onSubmit={updateForm.handleSubmit(onUpdatePassword)} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <div className="ml-2">{error}</div>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="password">New Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="Create a new password"
          autoComplete="new-password"
          disabled={isLoading}
          {...updateForm.register('password')}
        />
        {updateForm.formState.errors.password && (
          <p className="text-sm text-red-600">
            {updateForm.formState.errors.password.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="Confirm your new password"
          autoComplete="new-password"
          disabled={isLoading}
          {...updateForm.register('confirmPassword')}
        />
        {updateForm.formState.errors.confirmPassword && (
          <p className="text-sm text-red-600">
            {updateForm.formState.errors.confirmPassword.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Updating...
          </>
        ) : (
          'Update password'
        )}
      </Button>
    </form>
  )
}
