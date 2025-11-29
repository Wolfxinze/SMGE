'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createBrand(formData: FormData) {
  const supabase = await createClient()

  // Get authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'You must be logged in to create a brand' }
  }

  // Extract form data
  const brandName = formData.get('brand-name') as string
  const description = formData.get('description') as string
  const industry = formData.get('industry') as string
  const targetAudience = formData.get('target-audience') as string
  const brandVoice = formData.get('brand-voice') as string
  const primaryColor = formData.get('primary-color') as string
  const platforms = formData.getAll('platforms') as string[]

  // Validate required fields
  if (!brandName) {
    return { error: 'Brand name is required' }
  }

  try {
    // 1. Get user's agency (should exist from signup trigger)
    // Note: 'agencies' table is not yet in generated types - using type assertion
    const { data: agencies, error: agencyError } = await (supabase as any)
      .from('agencies')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1)

    if (agencyError) {
      console.error('Agency lookup error:', agencyError)
      return { error: 'Failed to find your agency. Please contact support.' }
    }

    if (!agencies || agencies.length === 0) {
      console.error('No agency found for user:', user.id)
      return { error: 'No agency found. Please contact support.' }
    }

    const agencyId = agencies[0].id

    // 2. Create the brand record
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .insert({
        user_id: user.id,
        agency_id: agencyId,
        name: brandName,
        description: description || null,
        industry: industry || null,
        is_active: true,
        onboarding_completed: false,
      })
      .select()
      .single()

    if (brandError) {
      console.error('Brand creation error:', brandError)
      return { error: `Failed to create brand: ${brandError.message}` }
    }

    // 3. Create brand voice if provided
    if (brandVoice && brand) {
      const toneScores: Record<string, number> = {}

      // Map voice selection to tone scores
      switch (brandVoice) {
        case 'professional':
          toneScores.professional = 0.9
          toneScores.authoritative = 0.7
          toneScores.friendly = 0.3
          break
        case 'friendly':
          toneScores.friendly = 0.9
          toneScores.professional = 0.5
          toneScores.casual = 0.6
          break
        case 'casual':
          toneScores.casual = 0.9
          toneScores.friendly = 0.7
          toneScores.professional = 0.2
          break
        case 'authoritative':
          toneScores.authoritative = 0.9
          toneScores.professional = 0.8
          toneScores.friendly = 0.2
          break
      }

      const { error: voiceError } = await supabase.from('brand_voice').insert({
        brand_id: brand.id,
        tone: toneScores,
        personality_traits: [brandVoice],
      })

      if (voiceError) {
        console.error('Brand voice creation error:', voiceError)
        // Continue even if voice creation fails
      }
    }

    // 4. Create target audience if provided
    if (targetAudience && brand) {
      const { error: audienceError } = await supabase
        .from('target_audiences')
        .insert({
          brand_id: brand.id,
          persona_name: 'Primary Audience',
          is_primary: true,
          demographics: {
            description: targetAudience,
          },
          preferred_channels: platforms,
        })

      if (audienceError) {
        console.error('Target audience creation error:', audienceError)
        // Continue even if audience creation fails
      }
    }

    // 5. Create brand guidelines if color provided
    if (primaryColor && brand) {
      const { error: guidelinesError } = await supabase
        .from('brand_guidelines')
        .insert({
          brand_id: brand.id,
          colors: {
            primary: primaryColor,
          },
          platform_guidelines: platforms.reduce(
            (acc, platform) => {
              acc[platform] = { enabled: true }
              return acc
            },
            {} as Record<string, { enabled: boolean }>
          ),
        })

      if (guidelinesError) {
        console.error('Brand guidelines creation error:', guidelinesError)
        // Continue even if guidelines creation fails
      }
    }

    // Success - redirect to dashboard
    redirect('/dashboard')
  } catch (error) {
    console.error('Unexpected error creating brand:', error)
    return {
      error:
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred',
    }
  }
}
