import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const stats = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[],
    }

    // Get posts due for publishing
    const { data: queueItems, error: fetchError } = await supabase
      .rpc('get_posts_due_for_publishing', { p_lookahead_minutes: 5 })

    if (fetchError) {
      throw fetchError
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('No posts due for publishing')
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          timestamp: new Date().toISOString(),
          message: 'No posts due for publishing'
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      )
    }

    console.log(`Processing ${queueItems.length} scheduled posts`)

    // Process each post
    for (const item of queueItems) {
      stats.processed++

      try {
        // Mark as processing
        await supabase
          .from('scheduled_posts')
          .update({
            status: 'processing',
            processing_started_at: new Date().toISOString(),
          })
          .eq('id', item.scheduled_post_id)

        // Get social account credentials
        const { data: socialAccount, error: accountError } = await supabase
          .from('social_accounts')
          .select('*')
          .eq('id', item.social_account_id)
          .single()

        if (accountError || !socialAccount) {
          throw new Error('Social account not found or inactive')
        }

        // Check rate limits before publishing
        const platformLimits: Record<string, { limit: number; window_minutes: number }> = {
          twitter: { limit: 300, window_minutes: 180 },
          instagram: { limit: 200, window_minutes: 1440 },
          linkedin: { limit: 100, window_minutes: 1440 },
          tiktok: { limit: 100, window_minutes: 1440 },
          facebook: { limit: 200, window_minutes: 1440 },
        }

        const platformConfig = platformLimits[item.platform]
        if (platformConfig) {
          const { data: canPublish, error: rateLimitError } = await supabase.rpc('check_rate_limit', {
            p_social_account_id: item.social_account_id,
            p_platform: item.platform,
            p_endpoint: '/posts/create',
            p_limit: platformConfig.limit,
            p_window_seconds: platformConfig.window_minutes * 60,
          })

          if (rateLimitError) {
            console.warn(`Rate limit check failed for ${item.platform}:`, rateLimitError)
          } else if (!canPublish) {
            throw new Error(`Rate limit exceeded for ${item.platform}`)
          }
        }

        // Fetch full post data
        const { data: post, error: postError } = await supabase
          .from('posts')
          .select('*')
          .eq('id', item.post_id)
          .single()

        if (postError || !post) {
          throw new Error('Post not found')
        }

        // TODO: Here you would integrate with the actual platform APIs
        // For now, we'll simulate a successful publish
        console.log(`Publishing post ${item.post_id} to ${item.platform}`)

        // Simulate platform API call
        const result = {
          success: true,
          platform_post_id: `${item.platform}_${Date.now()}`,
          platform_url: `https://${item.platform}.com/posts/${Date.now()}`
        }

        if (result.success) {
          // Update status to published
          await supabase.rpc('update_scheduled_post_status', {
            p_scheduled_post_id: item.scheduled_post_id,
            p_new_status: 'published',
            p_platform_post_id: result.platform_post_id,
            p_platform_url: result.platform_url,
          })

          // Increment rate limit counter after successful publish
          await supabase.rpc('increment_rate_limit', {
            p_social_account_id: item.social_account_id,
            p_endpoint: '/posts/create',
          })

          stats.succeeded++
          console.log(`✓ Published post ${item.post_id} to ${item.platform}`)
        }
      } catch (error: any) {
        stats.failed++
        const errorMessage = error.message || 'Unknown error'
        stats.errors.push(`Post ${item.post_id}: ${errorMessage}`)

        console.error(`✗ Failed to publish post ${item.post_id}:`, errorMessage)

        // Update status to failed
        await supabase.rpc('update_scheduled_post_status', {
          p_scheduled_post_id: item.scheduled_post_id,
          p_new_status: 'failed',
          p_error_message: errorMessage,
        })
      }
    }

    // Process retries
    const { data: retryItems } = await supabase.rpc('get_posts_due_for_retry')

    if (retryItems && retryItems.length > 0) {
      console.log(`Processing ${retryItems.length} retry attempts`)

      for (const item of retryItems) {
        // Reset to pending status so next run picks them up
        await supabase
          .from('scheduled_posts')
          .update({
            status: 'pending',
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.scheduled_post_id)
      }
    }

    console.log(`Processing completed: ${stats.succeeded} succeeded, ${stats.failed} failed`)

    return new Response(
      JSON.stringify({
        success: true,
        processed: stats.processed,
        succeeded: stats.succeeded,
        failed: stats.failed,
        errors: stats.errors,
        timestamp: new Date().toISOString()
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    console.error('Error processing scheduled posts:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: String(error),
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})