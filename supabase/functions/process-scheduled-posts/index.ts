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

    // Call the existing database function to process scheduled posts
    // This function processes posts scheduled within the next 5 minutes
    const { data, error } = await supabase.rpc('process_scheduled_posts', {
      p_lookahead_minutes: 5
    })

    if (error) {
      console.error('Error calling process_scheduled_posts RPC:', error)
      throw error
    }

    // Log the results for monitoring
    console.log(`Processed ${data?.length || 0} scheduled posts at ${new Date().toISOString()}`)

    if (data && data.length > 0) {
      console.log('Processed posts:', data.map((post: any) => ({
        id: post.id,
        platform: post.platform,
        scheduled_for: post.scheduled_for,
        status: post.status
      })))
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: data?.length || 0,
        timestamp: new Date().toISOString(),
        posts: data || []
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