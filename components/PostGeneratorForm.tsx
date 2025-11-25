'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'

interface PostGeneratorFormProps {
  brandId: string
  onPostGenerated?: (post: any) => void
}

export function PostGeneratorForm({ brandId, onPostGenerated }: PostGeneratorFormProps) {
  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState<string>('')
  const [contentType, setContentType] = useState('post')
  const [includeHashtags, setIncludeHashtags] = useState(true)
  const [includeCallToAction, setIncludeCallToAction] = useState(false)
  const [maxLength, setMaxLength] = useState<number | undefined>()

  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedPost, setGeneratedPost] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!topic || !platform) {
      setError('Please provide a topic and select a platform')
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch('/api/posts/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          brand_id: brandId,
          topic,
          platform,
          content_type: contentType,
          include_hashtags: includeHashtags,
          include_call_to_action: includeCallToAction,
          max_length: maxLength,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate post')
      }

      const data = await response.json()
      setGeneratedPost(data.post)

      if (onPostGenerated) {
        onPostGenerated(data.post)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsGenerating(false)
    }
  }

  const platformOptions = [
    { value: 'instagram', label: 'Instagram', maxLength: 2200 },
    { value: 'twitter', label: 'Twitter/X', maxLength: 280 },
    { value: 'linkedin', label: 'LinkedIn', maxLength: 3000 },
    { value: 'tiktok', label: 'TikTok', maxLength: 2200 },
    { value: 'facebook', label: 'Facebook', maxLength: 63206 },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate Post</CardTitle>
          <CardDescription>
            Create AI-powered social media content using your brand voice
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Topic Input */}
          <div className="space-y-2">
            <Label htmlFor="topic">What should this post be about?</Label>
            <Textarea
              id="topic"
              placeholder="E.g., Announcing our new product launch, sharing customer success story, tips for productivity..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
            />
          </div>

          {/* Platform Selection */}
          <div className="space-y-2">
            <Label htmlFor="platform">Platform</Label>
            <Select value={platform} onValueChange={(value) => {
              setPlatform(value)
              const selectedPlatform = platformOptions.find(p => p.value === value)
              if (selectedPlatform) {
                setMaxLength(selectedPlatform.maxLength)
              }
            }}>
              <SelectTrigger id="platform">
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                {platformOptions.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Content Type */}
          <div className="space-y-2">
            <Label htmlFor="contentType">Content Type</Label>
            <Select value={contentType} onValueChange={setContentType}>
              <SelectTrigger id="contentType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="post">Post</SelectItem>
                <SelectItem value="story">Story</SelectItem>
                <SelectItem value="reel">Reel/Video</SelectItem>
                <SelectItem value="thread">Thread</SelectItem>
                <SelectItem value="article">Article</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="hashtags" className="cursor-pointer">
                Include hashtags
              </Label>
              <Switch
                id="hashtags"
                checked={includeHashtags}
                onCheckedChange={setIncludeHashtags}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="cta" className="cursor-pointer">
                Include call-to-action
              </Label>
              <Switch
                id="cta"
                checked={includeCallToAction}
                onCheckedChange={setIncludeCallToAction}
              />
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !topic || !platform}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Post'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Post Preview */}
      {generatedPost && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Content</CardTitle>
            <CardDescription>
              Preview and edit before scheduling or publishing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={generatedPost.content}
              onChange={(e) => setGeneratedPost({
                ...generatedPost,
                content: e.target.value
              })}
              rows={8}
              className="font-sans"
            />

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setGeneratedPost(null)}>
                Discard
              </Button>
              <Button onClick={handleGenerate} variant="outline">
                Regenerate
              </Button>
              <Button className="flex-1">
                Save Draft
              </Button>
              <Button className="flex-1" variant="default">
                Schedule Post
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              <p>Model: {generatedPost.ai_model}</p>
              <p>Platform: {generatedPost.platform}</p>
              <p>Length: {generatedPost.content.length} characters</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
