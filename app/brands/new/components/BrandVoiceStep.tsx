'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface BrandVoiceStepProps {
  formData: {
    tone: string[]
    writingStyle: string
    personalityTraits: string[]
  }
  onChange: (field: string, value: any) => void
  errors?: Record<string, string>
}

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional', description: 'Formal and business-like' },
  { value: 'casual', label: 'Casual', description: 'Relaxed and friendly' },
  { value: 'playful', label: 'Playful', description: 'Fun and energetic' },
  { value: 'authoritative', label: 'Authoritative', description: 'Expert and confident' },
  { value: 'empathetic', label: 'Empathetic', description: 'Understanding and caring' },
  { value: 'inspiring', label: 'Inspiring', description: 'Motivational and uplifting' }
]

const PERSONALITY_TRAITS = [
  'Innovative', 'Trustworthy', 'Bold', 'Friendly', 'Sophisticated',
  'Adventurous', 'Reliable', 'Creative', 'Caring', 'Dynamic',
  'Premium', 'Accessible', 'Authentic', 'Forward-thinking', 'Traditional'
]

export function BrandVoiceStep({ formData, onChange, errors }: BrandVoiceStepProps) {
  const toggleTone = (tone: string) => {
    const currentTones = formData.tone || []
    const newTones = currentTones.includes(tone)
      ? currentTones.filter(t => t !== tone)
      : [...currentTones, tone]
    onChange('tone', newTones)
  }

  const toggleTrait = (trait: string) => {
    const currentTraits = formData.personalityTraits || []
    const newTraits = currentTraits.includes(trait)
      ? currentTraits.filter(t => t !== trait)
      : currentTraits.length < 5
        ? [...currentTraits, trait]
        : currentTraits
    onChange('personalityTraits', newTraits)
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Define your brand voice</h2>
        <p className="text-muted-foreground">
          How should your brand communicate? This helps us generate content that sounds like you.
        </p>
      </div>

      {/* Tone Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          Tone <span className="text-destructive">*</span>
        </Label>
        <p className="text-sm text-muted-foreground">
          Select all that apply. Choose 2-3 tones that best represent your brand.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TONE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleTone(option.value)}
              className={cn(
                'p-4 rounded-lg border-2 text-left transition-all duration-200',
                'hover:border-accent/50 hover:shadow-md',
                formData.tone?.includes(option.value)
                  ? 'border-accent bg-accent/5 shadow-md'
                  : 'border-border bg-card'
              )}
            >
              <div className="font-medium mb-1">{option.label}</div>
              <div className="text-sm text-muted-foreground">{option.description}</div>
            </button>
          ))}
        </div>
        {errors?.tone && (
          <p className="text-sm text-destructive animate-shake">{errors.tone}</p>
        )}
      </div>

      {/* Writing Style */}
      <div className="space-y-2">
        <Label htmlFor="writingStyle" className="text-sm font-medium">
          Writing Style <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="writingStyle"
          placeholder="Describe your preferred writing style... e.g., 'We use short, punchy sentences. We avoid jargon. We speak directly to our customers.'"
          value={formData.writingStyle}
          onChange={(e) => onChange('writingStyle', e.target.value)}
          className={errors?.writingStyle ? 'border-destructive' : ''}
          rows={4}
        />
        {errors?.writingStyle && (
          <p className="text-sm text-destructive animate-shake">{errors.writingStyle}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Any specific writing guidelines, sentence structure preferences, or language patterns
        </p>
      </div>

      {/* Personality Traits */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          Personality Traits <span className="text-destructive">*</span>
        </Label>
        <p className="text-sm text-muted-foreground">
          Select 3-5 traits that define your brand's personality
        </p>
        <div className="flex flex-wrap gap-2">
          {PERSONALITY_TRAITS.map((trait) => (
            <Badge
              key={trait}
              variant={formData.personalityTraits?.includes(trait) ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer px-3 py-1.5 text-sm transition-all duration-200',
                formData.personalityTraits?.includes(trait)
                  ? 'bg-accent text-primary shadow-md hover:bg-accent/90'
                  : 'hover:border-accent hover:text-accent'
              )}
              onClick={() => toggleTrait(trait)}
            >
              {trait}
            </Badge>
          ))}
        </div>
        {formData.personalityTraits && formData.personalityTraits.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Selected: {formData.personalityTraits.length} / 5
          </p>
        )}
        {errors?.personalityTraits && (
          <p className="text-sm text-destructive animate-shake">{errors.personalityTraits}</p>
        )}
      </div>
    </div>
  )
}
