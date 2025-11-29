'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Step {
  id: number
  name: string
  description: string
}

interface WizardProgressProps {
  steps: Step[]
  currentStep: number
}

export function WizardProgress({ steps, currentStep }: WizardProgressProps) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center justify-between">
        {steps.map((step, stepIdx) => (
          <li
            key={step.id}
            className={cn(
              'relative',
              stepIdx !== steps.length - 1 ? 'pr-8 sm:pr-20 flex-1' : ''
            )}
          >
            {/* Progress Line */}
            {stepIdx !== steps.length - 1 && (
              <div
                className="absolute top-4 left-0 -ml-px mt-0.5 h-0.5 w-full"
                aria-hidden="true"
              >
                <div
                  className={cn(
                    'h-full transition-all duration-500 ease-out',
                    currentStep > stepIdx
                      ? 'bg-accent'
                      : 'bg-border'
                  )}
                />
              </div>
            )}

            {/* Step Circle */}
            <div className="group relative flex items-start">
              <span className="flex h-9 items-center">
                <span
                  className={cn(
                    'relative z-10 flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200',
                    currentStep > stepIdx
                      ? 'bg-accent shadow-md'
                      : currentStep === stepIdx
                      ? 'border-2 border-accent bg-background shadow-lg ring-4 ring-accent/10'
                      : 'border-2 border-border bg-background'
                  )}
                >
                  {currentStep > stepIdx ? (
                    <Check className="h-4 w-4 text-primary animate-scale-in" />
                  ) : (
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        currentStep === stepIdx
                          ? 'text-accent'
                          : 'text-muted-foreground'
                      )}
                    >
                      {step.id}
                    </span>
                  )}
                </span>
              </span>

              {/* Step Label */}
              <span className="ml-4 flex min-w-0 flex-col">
                <span
                  className={cn(
                    'text-sm font-medium transition-colors',
                    currentStep >= stepIdx
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  )}
                >
                  {step.name}
                </span>
                <span className="text-xs text-muted-foreground hidden sm:block">
                  {step.description}
                </span>
              </span>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  )
}
