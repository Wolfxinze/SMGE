'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TargetAudienceStepProps {
  formData: {
    demographics: {
      ageRange: string
      gender: string
      location: string
      occupation: string
    }
    interests: string[]
    painPoints: string[]
  }
  onChange: (field: string, value: any) => void
  errors?: Record<string, string>
}

export function TargetAudienceStep({ formData, onChange, errors }: TargetAudienceStepProps) {
  const addInterest = () => {
    const interests = formData.interests || []
    onChange('interests', [...interests, ''])
  }

  const updateInterest = (index: number, value: string) => {
    const interests = [...(formData.interests || [])]
    interests[index] = value
    onChange('interests', interests)
  }

  const removeInterest = (index: number) => {
    const interests = formData.interests.filter((_, i) => i !== index)
    onChange('interests', interests)
  }

  const addPainPoint = () => {
    const painPoints = formData.painPoints || []
    onChange('painPoints', [...painPoints, ''])
  }

  const updatePainPoint = (index: number, value: string) => {
    const painPoints = [...(formData.painPoints || [])]
    painPoints[index] = value
    onChange('painPoints', painPoints)
  }

  const removePainPoint = (index: number) => {
    const painPoints = formData.painPoints.filter((_, i) => i !== index)
    onChange('painPoints', painPoints)
  }

  const updateDemographic = (field: string, value: string) => {
    onChange('demographics', {
      ...formData.demographics,
      [field]: value
    })
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Who is your target audience?</h2>
        <p className="text-muted-foreground">
          Understanding your audience helps us create content that resonates with them.
        </p>
      </div>

      {/* Demographics */}
      <div className="space-y-4">
        <Label className="text-sm font-medium">Demographics</Label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ageRange" className="text-sm">Age Range</Label>
            <Input
              id="ageRange"
              placeholder="e.g., 25-45"
              value={formData.demographics?.ageRange || ''}
              onChange={(e) => updateDemographic('ageRange', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender" className="text-sm">Gender</Label>
            <select
              id="gender"
              value={formData.demographics?.gender || ''}
              onChange={(e) => updateDemographic('gender', e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Select</option>
              <option value="All">All</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Non-binary">Non-binary</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location" className="text-sm">Location</Label>
            <Input
              id="location"
              placeholder="e.g., Singapore, Southeast Asia"
              value={formData.demographics?.location || ''}
              onChange={(e) => updateDemographic('location', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="occupation" className="text-sm">Occupation</Label>
            <Input
              id="occupation"
              placeholder="e.g., Business professionals"
              value={formData.demographics?.occupation || ''}
              onChange={(e) => updateDemographic('occupation', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Interests */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">
            Interests & Hobbies <span className="text-destructive">*</span>
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addInterest}
            className="h-8"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Interest
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          What topics, activities, or interests does your audience care about?
        </p>

        {formData.interests && formData.interests.length > 0 ? (
          <div className="space-y-2">
            {formData.interests.map((interest, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder={`Interest ${index + 1}`}
                  value={interest}
                  onChange={(e) => updateInterest(index, e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeInterest(index)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Click "Add Interest" to get started
          </p>
        )}
        {errors?.interests && (
          <p className="text-sm text-destructive animate-shake">{errors.interests}</p>
        )}
      </div>

      {/* Pain Points */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">
            Pain Points & Challenges <span className="text-destructive">*</span>
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addPainPoint}
            className="h-8"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Pain Point
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          What problems or challenges does your audience face that your brand solves?
        </p>

        {formData.painPoints && formData.painPoints.length > 0 ? (
          <div className="space-y-2">
            {formData.painPoints.map((painPoint, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder={`Pain point ${index + 1}`}
                  value={painPoint}
                  onChange={(e) => updatePainPoint(index, e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removePainPoint(index)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Click "Add Pain Point" to get started
          </p>
        )}
        {errors?.painPoints && (
          <p className="text-sm text-destructive animate-shake">{errors.painPoints}</p>
        )}
      </div>
    </div>
  )
}
