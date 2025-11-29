'use client'

import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface WizardNavigationProps {
  currentStep: number
  totalSteps: number
  onBack: () => void
  onNext: () => void
  onSubmit?: () => void
  isFirstStep: boolean
  isLastStep: boolean
  isSubmitting?: boolean
  canProceed?: boolean
}

export function WizardNavigation({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  onSubmit,
  isFirstStep,
  isLastStep,
  isSubmitting = false,
  canProceed = true
}: WizardNavigationProps) {
  const handleNext = () => {
    if (isLastStep && onSubmit) {
      onSubmit()
    } else {
      onNext()
    }
  }

  return (
    <div className="flex items-center justify-between pt-6 border-t">
      {/* Back Button */}
      <Button
        type="button"
        variant="outline"
        onClick={onBack}
        disabled={isFirstStep || isSubmitting}
        className="group"
      >
        <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
        Back
      </Button>

      {/* Progress Text */}
      <div className="hidden sm:block">
        <span className="text-sm text-muted-foreground">
          Step {currentStep + 1} of {totalSteps}
        </span>
      </div>

      {/* Next/Submit Button */}
      <Button
        type="button"
        onClick={handleNext}
        disabled={!canProceed || isSubmitting}
        className="group min-w-[120px]"
      >
        {isSubmitting ? (
          <>
            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Creating...
          </>
        ) : isLastStep ? (
          'Create Brand'
        ) : (
          <>
            Next
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </>
        )}
      </Button>
    </div>
  )
}
