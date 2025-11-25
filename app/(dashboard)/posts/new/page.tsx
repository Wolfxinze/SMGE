'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PostGeneratorForm } from '@/components/PostGeneratorForm'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Brand {
  id: string
  name: string
  industry: string
}

export default function NewPostPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrandId, setSelectedBrandId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadBrands() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          setError('Please log in to create posts')
          return
        }

        const { data: brandsData, error: brandsError } = await supabase
          .from('brands')
          .select('id, name, industry')
          .eq('user_id', user.id)
          .order('name')

        if (brandsError) throw brandsError

        if (!brandsData || brandsData.length === 0) {
          setError('No brands found. Please create a brand first.')
          return
        }

        setBrands(brandsData as Brand[])
        // Auto-select first brand
        setSelectedBrandId((brandsData as Brand[])[0].id)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load brands')
      } finally {
        setLoading(false)
      }
    }

    loadBrands()
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <p>Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create New Post</h1>
        <p className="text-muted-foreground">
          Generate AI-powered social media content using your brand voice
        </p>
      </div>

      {brands.length > 1 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select Brand</CardTitle>
            <CardDescription>Choose which brand to create content for</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="brand-select">Brand</Label>
              <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                <SelectTrigger id="brand-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name} ({brand.industry})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      <PostGeneratorForm
        brandId={selectedBrandId}
        onPostGenerated={(_post) => {
          // Optional: Navigate to post detail or queue
          // TODO: Add navigation or success notification
        }}
      />
    </div>
  )
}
