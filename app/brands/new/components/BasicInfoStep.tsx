'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface BasicInfoStepProps {
  formData: {
    name: string
    industry: string
    description: string
    tagline: string
    website: string
  }
  onChange: (field: string, value: string) => void
  errors?: Record<string, string>
}

const INDUSTRIES = [
  'Technology',
  'Healthcare',
  'Finance',
  'E-commerce',
  'Education',
  'Entertainment',
  'Food & Beverage',
  'Fashion',
  'Travel',
  'Real Estate',
  'Consulting',
  'Other'
]

export function BasicInfoStep({ formData, onChange, errors }: BasicInfoStepProps) {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Tell us about your brand</h2>
        <p className="text-muted-foreground">
          Let's start with the basics. This information helps us understand your brand's identity.
        </p>
      </div>

      {/* Brand Name */}
      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-medium">
          Brand Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          placeholder="e.g., Singapore Airlines"
          value={formData.name}
          onChange={(e) => onChange('name', e.target.value)}
          className={errors?.name ? 'border-destructive' : ''}
          autoFocus
        />
        {errors?.name && (
          <p className="text-sm text-destructive animate-shake">{errors.name}</p>
        )}
      </div>

      {/* Industry */}
      <div className="space-y-2">
        <Label htmlFor="industry" className="text-sm font-medium">
          Industry <span className="text-destructive">*</span>
        </Label>
        <select
          id="industry"
          value={formData.industry}
          onChange={(e) => onChange('industry', e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Select an industry</option>
          {INDUSTRIES.map((industry) => (
            <option key={industry} value={industry}>
              {industry}
            </option>
          ))}
        </select>
        {errors?.industry && (
          <p className="text-sm text-destructive animate-shake">{errors.industry}</p>
        )}
      </div>

      {/* Tagline */}
      <div className="space-y-2">
        <Label htmlFor="tagline" className="text-sm font-medium">
          Tagline
        </Label>
        <Input
          id="tagline"
          placeholder="e.g., A Great Way to Fly"
          value={formData.tagline}
          onChange={(e) => onChange('tagline', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Your brand's memorable catchphrase or slogan
        </p>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-sm font-medium">
          Brand Description <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="description"
          placeholder="Describe what your brand does and what makes it unique..."
          value={formData.description}
          onChange={(e) => onChange('description', e.target.value)}
          className={errors?.description ? 'border-destructive' : ''}
          rows={4}
        />
        {errors?.description && (
          <p className="text-sm text-destructive animate-shake">{errors.description}</p>
        )}
        <p className="text-xs text-muted-foreground">
          A brief overview of your brand's purpose and value proposition
        </p>
      </div>

      {/* Website */}
      <div className="space-y-2">
        <Label htmlFor="website" className="text-sm font-medium">
          Website
        </Label>
        <Input
          id="website"
          type="url"
          placeholder="https://example.com"
          value={formData.website}
          onChange={(e) => onChange('website', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Your brand's website URL (optional)
        </p>
      </div>
    </div>
  )
}
