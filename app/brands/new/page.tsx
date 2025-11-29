'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { WizardProgress } from './components/WizardProgress'
import { WizardNavigation } from './components/WizardNavigation'
import { BasicInfoStep } from './components/BasicInfoStep'
import { BrandVoiceStep } from './components/BrandVoiceStep'
import { TargetAudienceStep } from './components/TargetAudienceStep'
import { ContentPillarsStep } from './components/ContentPillarsStep'
import { VisualIdentityStep } from './components/VisualIdentityStep'
import { ReviewStep } from './components/ReviewStep'
import { createClient } from '@/lib/supabase/client'
import { Sparkles } from 'lucide-react'

const STEPS = [
  { id: 1, name: 'Basic Info', description: 'Brand basics' },
  { id: 2, name: 'Brand Voice', description: 'Tone & style' },
  { id: 3, name: 'Target Audience', description: 'Who you serve' },
  { id: 4, name: 'Content Pillars', description: 'Content themes' },
  { id: 5, name: 'Visual Identity', description: 'Colors & style' },
  { id: 6, name: 'Review', description: 'Confirm & create' }
]

interface FormData {
  // Basic Info
  name: string
  industry: string
  description: string
  tagline: string
  website: string

  // Brand Voice
  tone: string[]
  writingStyle: string
  personalityTraits: string[]

  // Target Audience
  demographics: {
    ageRange: string
    gender: string
    location: string
    occupation: string
  }
  interests: string[]
  painPoints: string[]

  // Content Pillars
  contentPillars: Array<{
    name: string
    description: string
  }>

  // Visual Identity
  primaryColor: string
  secondaryColor: string
  imageStyle: string[]
  logoUrl?: string
}

export default function NewBrandPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState<FormData>({
    name: '',
    industry: '',
    description: '',
    tagline: '',
    website: '',
    tone: [],
    writingStyle: '',
    personalityTraits: [],
    demographics: {
      ageRange: '',
      gender: '',
      location: '',
      occupation: ''
    },
    interests: [],
    painPoints: [],
    contentPillars: [],
    primaryColor: '#0a1628',
    secondaryColor: '#d4a574',
    imageStyle: [],
    logoUrl: ''
  })

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }))
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {}

    switch (step) {
      case 0: // Basic Info
        if (!formData.name.trim()) {
          newErrors.name = 'Brand name is required'
        }
        if (!formData.industry) {
          newErrors.industry = 'Please select an industry'
        }
        if (!formData.description.trim()) {
          newErrors.description = 'Brand description is required'
        }
        break

      case 1: // Brand Voice
        if (!formData.tone || formData.tone.length === 0) {
          newErrors.tone = 'Please select at least one tone'
        }
        if (!formData.writingStyle.trim()) {
          newErrors.writingStyle = 'Writing style is required'
        }
        if (!formData.personalityTraits || formData.personalityTraits.length === 0) {
          newErrors.personalityTraits = 'Please select at least one personality trait'
        }
        break

      case 2: // Target Audience
        const validInterests = formData.interests.filter(i => i.trim())
        if (validInterests.length === 0) {
          newErrors.interests = 'Please add at least one interest'
        }
        const validPainPoints = formData.painPoints.filter(p => p.trim())
        if (validPainPoints.length === 0) {
          newErrors.painPoints = 'Please add at least one pain point'
        }
        break

      case 3: // Content Pillars
        if (!formData.contentPillars || formData.contentPillars.length < 3) {
          newErrors.contentPillars = 'Please add at least 3 content pillars'
        } else {
          const incompletePillars = formData.contentPillars.some(
            p => !p.name.trim() || !p.description.trim()
          )
          if (incompletePillars) {
            newErrors.contentPillars = 'Please complete all content pillar fields'
          }
        }
        break

      case 4: // Visual Identity
        if (!formData.primaryColor) {
          newErrors.primaryColor = 'Primary color is required'
        }
        if (!formData.imageStyle || formData.imageStyle.length === 0) {
          newErrors.imageStyle = 'Please select at least one image style'
        }
        break

      case 5: // Review - no validation needed
        break
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleEdit = (step: number) => {
    setCurrentStep(step)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)

    try {
      const supabase = createClient()

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('You must be logged in to create a brand')
      }

      // Create brand
      const { data: brand, error: brandError } = await supabase
        .from('brands')
        .insert({
          user_id: user.id,
          name: formData.name,
          industry: formData.industry,
          description: formData.description,
          tagline: formData.tagline || null,
          website: formData.website || null,
          onboarding_completed: true,
          is_active: true
        })
        .select()
        .single()

      if (brandError) throw brandError

      // Create brand voice profile
      const { error: voiceError } = await supabase
        .from('brand_voice')
        .insert({
          brand_id: brand.id,
          tone: formData.tone,
          writing_style: formData.writingStyle,
          personality_traits: formData.personalityTraits
        })

      if (voiceError) throw voiceError

      // Create target audience
      const { error: audienceError } = await supabase
        .from('target_audiences')
        .insert({
          brand_id: brand.id,
          persona_name: 'Primary Audience',
          demographics: formData.demographics,
          psychographics: {
            interests: formData.interests.filter(i => i.trim()),
            values: [],
            lifestyle: []
          },
          pain_points: formData.painPoints.filter(p => p.trim()),
          is_primary: true
        })

      if (audienceError) throw audienceError

      // Create content pillars
      if (formData.contentPillars.length > 0) {
        const pillarsToInsert = formData.contentPillars.map((pillar) => ({
          brand_id: brand.id,
          user_id: user.id,
          name: pillar.name,
          description: pillar.description,
          is_active: true
        }))

        const { error: pillarsError } = await supabase
          .from('content_pillars')
          .insert(pillarsToInsert)

        if (pillarsError) throw pillarsError
      }

      // Create brand guidelines (visual identity)
      const { error: guidelinesError } = await supabase
        .from('brand_guidelines')
        .insert({
          brand_id: brand.id,
          colors: {
            primary: formData.primaryColor,
            secondary: formData.secondaryColor
          },
          logo_urls: formData.logoUrl ? [formData.logoUrl] : null,
          imagery_style: {
            styles: formData.imageStyle,
            preferences: []
          }
        })

      if (guidelinesError) throw guidelinesError

      // Success! Redirect to brand page
      router.push(`/brands/${brand.id}`)
    } catch (error) {
      console.error('Error creating brand:', error)
      alert('Failed to create brand. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <BasicInfoStep
            formData={formData}
            onChange={handleFieldChange}
            errors={errors}
          />
        )
      case 1:
        return (
          <BrandVoiceStep
            formData={formData}
            onChange={handleFieldChange}
            errors={errors}
          />
        )
      case 2:
        return (
          <TargetAudienceStep
            formData={formData}
            onChange={handleFieldChange}
            errors={errors}
          />
        )
      case 3:
        return (
          <ContentPillarsStep
            formData={formData}
            onChange={handleFieldChange}
            errors={errors}
          />
        )
      case 4:
        return (
          <VisualIdentityStep
            formData={formData}
            onChange={handleFieldChange}
            errors={errors}
          />
        )
      case 5:
        return <ReviewStep formData={formData} onEdit={handleEdit} />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center justify-center p-2 bg-accent/10 rounded-full mb-4">
            <Sparkles className="h-6 w-6 text-accent" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Create Your Brand Brain
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Build your AI-powered brand intelligence system in just a few steps
          </p>
        </div>

        {/* Progress Indicator */}
        <WizardProgress steps={STEPS} currentStep={currentStep} />

        {/* Step Content */}
        <Card className="p-6 sm:p-8 shadow-lg">
          {renderStep()}

          {/* Navigation */}
          <WizardNavigation
            currentStep={currentStep}
            totalSteps={STEPS.length}
            onBack={handleBack}
            onNext={handleNext}
            onSubmit={handleSubmit}
            isFirstStep={currentStep === 0}
            isLastStep={currentStep === STEPS.length - 1}
            isSubmitting={isSubmitting}
            canProceed={!isSubmitting}
          />
        </Card>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Need help? Check out our{' '}
            <a href="/docs/brand-brain" className="text-accent hover:underline">
              Brand Brain Guide
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
