'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface VisualIdentityStepProps {
  formData: {
    primaryColor: string
    secondaryColor: string
    imageStyle: string[]
    logoUrl?: string
  }
  onChange: (field: string, value: any) => void
  errors?: Record<string, string>
}

const IMAGE_STYLES = [
  { value: 'minimalist', label: 'Minimalist', description: 'Clean, simple, uncluttered' },
  { value: 'vibrant', label: 'Vibrant', description: 'Bold colors, energetic' },
  { value: 'professional', label: 'Professional', description: 'Polished, business-like' },
  { value: 'lifestyle', label: 'Lifestyle', description: 'Real people, authentic moments' },
  { value: 'luxury', label: 'Luxury', description: 'Premium, sophisticated' },
  { value: 'playful', label: 'Playful', description: 'Fun, creative, whimsical' }
]

export function VisualIdentityStep({ formData, onChange, errors }: VisualIdentityStepProps) {
  const [logoPreview, setLogoPreview] = useState<string | null>(formData.logoUrl || null)

  const toggleImageStyle = (style: string) => {
    const currentStyles = formData.imageStyle || []
    const newStyles = currentStyles.includes(style)
      ? currentStyles.filter(s => s !== style)
      : currentStyles.length < 3
        ? [...currentStyles, style]
        : currentStyles
    onChange('imageStyle', newStyles)
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        setLogoPreview(result)
        onChange('logoUrl', result)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeLogo = () => {
    setLogoPreview(null)
    onChange('logoUrl', '')
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Visual identity</h2>
        <p className="text-muted-foreground">
          Define your brand's visual style to ensure consistent and on-brand imagery.
        </p>
      </div>

      {/* Logo Upload */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Brand Logo</Label>
        <p className="text-sm text-muted-foreground">
          Upload your logo (optional) - PNG, JPG, or SVG
        </p>

        {logoPreview ? (
          <Card className="p-4 relative">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Logo uploaded</p>
                <p className="text-xs text-muted-foreground">
                  Your brand logo is ready
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={removeLogo}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ) : (
          <label className="block">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-accent/50 hover:bg-accent/5 transition-all duration-200 cursor-pointer">
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">Click to upload logo</p>
              <p className="text-xs text-muted-foreground">
                PNG, JPG, SVG up to 5MB
              </p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </div>
          </label>
        )}
      </div>

      {/* Color Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="primaryColor" className="text-sm font-medium">
            Primary Brand Color <span className="text-destructive">*</span>
          </Label>
          <div className="flex gap-3">
            <input
              type="color"
              id="primaryColor"
              value={formData.primaryColor || '#0a1628'}
              onChange={(e) => onChange('primaryColor', e.target.value)}
              className="h-10 w-16 rounded border border-input cursor-pointer"
            />
            <Input
              type="text"
              placeholder="#0a1628"
              value={formData.primaryColor || ''}
              onChange={(e) => onChange('primaryColor', e.target.value)}
              className="flex-1"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Your main brand color
          </p>
          {errors?.primaryColor && (
            <p className="text-sm text-destructive animate-shake">{errors.primaryColor}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="secondaryColor" className="text-sm font-medium">
            Secondary Color
          </Label>
          <div className="flex gap-3">
            <input
              type="color"
              id="secondaryColor"
              value={formData.secondaryColor || '#d4a574'}
              onChange={(e) => onChange('secondaryColor', e.target.value)}
              className="h-10 w-16 rounded border border-input cursor-pointer"
            />
            <Input
              type="text"
              placeholder="#d4a574"
              value={formData.secondaryColor || ''}
              onChange={(e) => onChange('secondaryColor', e.target.value)}
              className="flex-1"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Accent or complementary color
          </p>
        </div>
      </div>

      {/* Color Preview */}
      {formData.primaryColor && (
        <Card className="p-4">
          <p className="text-sm font-medium mb-3">Color Preview</p>
          <div className="flex gap-3">
            <div
              className="h-16 flex-1 rounded-lg shadow-sm"
              style={{ backgroundColor: formData.primaryColor }}
            />
            {formData.secondaryColor && (
              <div
                className="h-16 flex-1 rounded-lg shadow-sm"
                style={{ backgroundColor: formData.secondaryColor }}
              />
            )}
          </div>
        </Card>
      )}

      {/* Image Style Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          Image Style Preferences <span className="text-destructive">*</span>
        </Label>
        <p className="text-sm text-muted-foreground">
          Select up to 3 styles that match your brand's visual aesthetic
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {IMAGE_STYLES.map((style) => (
            <button
              key={style.value}
              type="button"
              onClick={() => toggleImageStyle(style.value)}
              className={cn(
                'p-4 rounded-lg border-2 text-left transition-all duration-200',
                'hover:border-accent/50 hover:shadow-md',
                formData.imageStyle?.includes(style.value)
                  ? 'border-accent bg-accent/5 shadow-md'
                  : 'border-border bg-card'
              )}
            >
              <div className="font-medium mb-1">{style.label}</div>
              <div className="text-sm text-muted-foreground">{style.description}</div>
            </button>
          ))}
        </div>
        {formData.imageStyle && formData.imageStyle.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Selected: {formData.imageStyle.length} / 3
          </p>
        )}
        {errors?.imageStyle && (
          <p className="text-sm text-destructive animate-shake">{errors.imageStyle}</p>
        )}
      </div>
    </div>
  )
}
