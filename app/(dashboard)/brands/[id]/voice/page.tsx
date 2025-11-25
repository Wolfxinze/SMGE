/**
 * Brand Voice Configuration Page
 */

import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BrandVoiceForm } from '@/components/brand-brain/brand-voice-form'
import { BrandLearningInterface } from '@/components/brand-brain/brand-learning-interface'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Brain, MessageSquare, Settings } from 'lucide-react'

export default async function BrandVoicePage({
  params
}: {
  params: { id: string }
}) {
  const supabase = createClient()

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  // Fetch brand details
  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (brandError || !brand) {
    notFound()
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Brain className="h-8 w-8" />
          {brand.name} - Brand Voice
        </h1>
        <p className="text-muted-foreground mt-2">
          Configure and train your brand's unique voice for AI-powered content generation
        </p>
      </div>

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-2xl">
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Voice Settings
          </TabsTrigger>
          <TabsTrigger value="learning" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Train AI
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <BrandVoiceForm brandId={params.id} />
        </TabsContent>

        <TabsContent value="learning">
          <BrandLearningInterface brandId={params.id} />
        </TabsContent>

        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle>Voice Preview</CardTitle>
              <CardDescription>
                Test your brand voice settings with AI-generated content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4" />
                <p>Content preview coming soon</p>
                <p className="text-sm mt-2">
                  This feature will allow you to test your brand voice settings
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}