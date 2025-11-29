'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit2, CheckCircle2 } from 'lucide-react'

interface ReviewStepProps {
  formData: any
  onEdit: (step: number) => void
}

export function ReviewStep({ formData, onEdit }: ReviewStepProps) {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Review your brand profile</h2>
        <p className="text-muted-foreground">
          Take a moment to review all the information before creating your Brand Brain.
        </p>
      </div>

      {/* Basic Info */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Basic Information</h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(0)}
          >
            <Edit2 className="h-4 w-4 mr-1" />
            Edit
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Brand Name</p>
            <p className="font-medium">{formData.name || 'Not provided'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Industry</p>
            <p className="font-medium">{formData.industry || 'Not provided'}</p>
          </div>
          {formData.tagline && (
            <div className="sm:col-span-2">
              <p className="text-sm text-muted-foreground mb-1">Tagline</p>
              <p className="font-medium">{formData.tagline}</p>
            </div>
          )}
          <div className="sm:col-span-2">
            <p className="text-sm text-muted-foreground mb-1">Description</p>
            <p className="font-medium">{formData.description || 'Not provided'}</p>
          </div>
          {formData.website && (
            <div className="sm:col-span-2">
              <p className="text-sm text-muted-foreground mb-1">Website</p>
              <a
                href={formData.website}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent hover:underline"
              >
                {formData.website}
              </a>
            </div>
          )}
        </div>
      </Card>

      {/* Brand Voice */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Brand Voice</h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(1)}
          >
            <Edit2 className="h-4 w-4 mr-1" />
            Edit
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Tone</p>
            <div className="flex flex-wrap gap-2">
              {formData.tone?.map((t: string) => (
                <Badge key={t} variant="secondary">
                  {t}
                </Badge>
              )) || <p className="text-sm text-muted-foreground">Not provided</p>}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Writing Style</p>
            <p className="font-medium">{formData.writingStyle || 'Not provided'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Personality Traits</p>
            <div className="flex flex-wrap gap-2">
              {formData.personalityTraits?.map((trait: string) => (
                <Badge key={trait} variant="outline">
                  {trait}
                </Badge>
              )) || <p className="text-sm text-muted-foreground">Not provided</p>}
            </div>
          </div>
        </div>
      </Card>

      {/* Target Audience */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Target Audience</h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(2)}
          >
            <Edit2 className="h-4 w-4 mr-1" />
            Edit
          </Button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Age Range</p>
              <p className="text-sm font-medium">{formData.demographics?.ageRange || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Gender</p>
              <p className="text-sm font-medium">{formData.demographics?.gender || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Location</p>
              <p className="text-sm font-medium">{formData.demographics?.location || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Occupation</p>
              <p className="text-sm font-medium">{formData.demographics?.occupation || 'N/A'}</p>
            </div>
          </div>

          {formData.interests && formData.interests.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Interests</p>
              <div className="flex flex-wrap gap-2">
                {formData.interests.filter((i: string) => i.trim()).map((interest: string, idx: number) => (
                  <Badge key={idx} variant="secondary">
                    {interest}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {formData.painPoints && formData.painPoints.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Pain Points</p>
              <div className="flex flex-wrap gap-2">
                {formData.painPoints.filter((p: string) => p.trim()).map((painPoint: string, idx: number) => (
                  <Badge key={idx} variant="outline">
                    {painPoint}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Content Pillars */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Content Pillars</h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(3)}
          >
            <Edit2 className="h-4 w-4 mr-1" />
            Edit
          </Button>
        </div>

        {formData.contentPillars && formData.contentPillars.length > 0 ? (
          <div className="space-y-3">
            {formData.contentPillars.map((pillar: any, idx: number) => (
              <div key={idx} className="border-l-4 border-accent pl-4 py-2">
                <p className="font-medium mb-1">{pillar.name}</p>
                <p className="text-sm text-muted-foreground">{pillar.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No content pillars added</p>
        )}
      </Card>

      {/* Visual Identity */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Visual Identity</h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(4)}
          >
            <Edit2 className="h-4 w-4 mr-1" />
            Edit
          </Button>
        </div>

        <div className="space-y-3">
          {formData.logoUrl && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Logo</p>
              <div className="h-16 w-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                <img
                  src={formData.logoUrl}
                  alt="Brand logo"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>
          )}

          <div>
            <p className="text-sm text-muted-foreground mb-2">Brand Colors</p>
            <div className="flex gap-3">
              {formData.primaryColor && (
                <div className="flex items-center gap-2">
                  <div
                    className="h-10 w-10 rounded border border-border shadow-sm"
                    style={{ backgroundColor: formData.primaryColor }}
                  />
                  <div>
                    <p className="text-xs text-muted-foreground">Primary</p>
                    <p className="text-sm font-mono">{formData.primaryColor}</p>
                  </div>
                </div>
              )}
              {formData.secondaryColor && (
                <div className="flex items-center gap-2">
                  <div
                    className="h-10 w-10 rounded border border-border shadow-sm"
                    style={{ backgroundColor: formData.secondaryColor }}
                  />
                  <div>
                    <p className="text-xs text-muted-foreground">Secondary</p>
                    <p className="text-sm font-mono">{formData.secondaryColor}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {formData.imageStyle && formData.imageStyle.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Image Style</p>
              <div className="flex flex-wrap gap-2">
                {formData.imageStyle.map((style: string) => (
                  <Badge key={style} variant="secondary">
                    {style}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Ready to Create */}
      <div className="bg-accent/10 border border-accent/20 rounded-lg p-6 flex items-start gap-4">
        <CheckCircle2 className="h-6 w-6 text-accent shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold mb-1">Ready to create your Brand Brain?</h4>
          <p className="text-sm text-muted-foreground">
            Once created, your Brand Brain will power AI-generated content that sounds authentically like your brand.
            You can always update these settings later.
          </p>
        </div>
      </div>
    </div>
  )
}
