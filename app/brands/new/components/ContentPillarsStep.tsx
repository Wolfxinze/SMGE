'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface ContentPillar {
  name: string
  description: string
}

interface ContentPillarsStepProps {
  formData: {
    contentPillars: ContentPillar[]
  }
  onChange: (field: string, value: any) => void
  errors?: Record<string, string>
}

const PILLAR_COLORS = [
  '#d4a574', // Gold
  '#0a1628', // Navy
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#a855f7'  // Purple
]

export function ContentPillarsStep({ formData, onChange, errors }: ContentPillarsStepProps) {
  const addPillar = () => {
    const pillars = formData.contentPillars || []
    if (pillars.length < 5) {
      onChange('contentPillars', [...pillars, { name: '', description: '' }])
    }
  }

  const updatePillar = (index: number, field: 'name' | 'description', value: string) => {
    const pillars = [...(formData.contentPillars || [])]
    pillars[index] = { ...pillars[index], [field]: value }
    onChange('contentPillars', pillars)
  }

  const removePillar = (index: number) => {
    const pillars = formData.contentPillars.filter((_, i) => i !== index)
    onChange('contentPillars', pillars)
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Define your content pillars</h2>
        <p className="text-muted-foreground">
          Content pillars are the 3-5 main themes or topics your brand focuses on. They guide your content strategy.
        </p>
      </div>

      {/* Add Pillar Button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">
            Content Pillars <span className="text-destructive">*</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Add 3-5 content themes that align with your brand
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={addPillar}
          disabled={(formData.contentPillars?.length || 0) >= 5}
          className="h-9"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Pillar
        </Button>
      </div>

      {/* Content Pillars List */}
      {formData.contentPillars && formData.contentPillars.length > 0 ? (
        <div className="space-y-4">
          {formData.contentPillars.map((pillar, index) => (
            <Card
              key={index}
              className="p-4 border-l-4 transition-all duration-200 hover:shadow-md"
              style={{ borderLeftColor: PILLAR_COLORS[index % PILLAR_COLORS.length] }}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-3">
                    {/* Pillar Name */}
                    <div className="space-y-1">
                      <Label htmlFor={`pillar-name-${index}`} className="text-sm">
                        Pillar {index + 1} Name
                      </Label>
                      <Input
                        id={`pillar-name-${index}`}
                        placeholder="e.g., Travel Inspiration, Customer Stories"
                        value={pillar.name}
                        onChange={(e) => updatePillar(index, 'name', e.target.value)}
                      />
                    </div>

                    {/* Pillar Description */}
                    <div className="space-y-1">
                      <Label htmlFor={`pillar-desc-${index}`} className="text-sm">
                        Description
                      </Label>
                      <Textarea
                        id={`pillar-desc-${index}`}
                        placeholder="Describe what this content pillar covers..."
                        value={pillar.description}
                        onChange={(e) => updatePillar(index, 'description', e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>

                  {/* Remove Button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removePillar(index)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center border-dashed">
          <p className="text-sm text-muted-foreground">
            No content pillars added yet. Click "Add Pillar" to get started.
          </p>
        </Card>
      )}

      {/* Progress Indicator */}
      {formData.contentPillars && formData.contentPillars.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{
                width: `${(formData.contentPillars.length / 5) * 100}%`
              }}
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {formData.contentPillars.length} / 5
          </span>
        </div>
      )}

      {errors?.contentPillars && (
        <p className="text-sm text-destructive animate-shake">{errors.contentPillars}</p>
      )}

      {/* Examples */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <p className="text-sm font-medium">Examples of Content Pillars:</p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Product Education - Tutorials and how-to guides</li>
          <li>Industry Insights - Trends and analysis in your field</li>
          <li>Customer Success - Case studies and testimonials</li>
          <li>Behind the Scenes - Company culture and team stories</li>
          <li>Tips & Best Practices - Expert advice and recommendations</li>
        </ul>
      </div>
    </div>
  )
}
