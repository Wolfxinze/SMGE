import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * n8n Webhook Handler
 * Receives webhook events from n8n workflows
 *
 * Security: Implements signature verification to ensure requests come from n8n
 * Pattern: Event-driven architecture for workflow triggers
 */

// Webhook event types
export interface N8NWebhookEvent {
  workflowId: string;
  executionId: string;
  event: string;
  data: Record<string, any>;
  timestamp: string;
}

// Response structure
interface WebhookResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

/**
 * Verify webhook signature from n8n
 * Uses HMAC SHA256 for signature verification
 */
function verifyWebhookSignature(
  body: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  // Constant time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Process webhook event based on type
 */
async function processWebhookEvent(event: N8NWebhookEvent): Promise<void> {
  console.log(`Processing n8n webhook event: ${event.event}`, {
    workflowId: event.workflowId,
    executionId: event.executionId,
    timestamp: event.timestamp
  });

  switch (event.event) {
    case 'content.generated':
      // Handle content generation completion
      await handleContentGenerated(event.data);
      break;

    case 'post.scheduled':
      // Handle post scheduling confirmation
      await handlePostScheduled(event.data);
      break;

    case 'analytics.updated':
      // Handle analytics update
      await handleAnalyticsUpdated(event.data);
      break;

    case 'workflow.error':
      // Handle workflow errors
      await handleWorkflowError(event.data);
      break;

    case 'brand.analysis.complete':
      // Handle brand analysis completion
      await handleBrandAnalysisComplete(event.data);
      break;

    default:
      console.warn(`Unhandled webhook event type: ${event.event}`);
  }
}

// Event handlers
async function handleContentGenerated(data: Record<string, any>) {
  // TODO: Update content status in database
  // TODO: Notify user via real-time subscription
  console.log('Content generated:', data);
}

async function handlePostScheduled(data: Record<string, any>) {
  // TODO: Update post status in database
  // TODO: Add to posting queue
  console.log('Post scheduled:', data);
}

async function handleAnalyticsUpdated(data: Record<string, any>) {
  // TODO: Store analytics data in database
  // TODO: Trigger performance calculations
  console.log('Analytics updated:', data);
}

async function handleWorkflowError(data: Record<string, any>) {
  // TODO: Log error to monitoring system
  // TODO: Send alert to admin
  console.error('Workflow error:', data);
}

async function handleBrandAnalysisComplete(data: Record<string, any>) {
  // TODO: Update brand brain with analysis results
  // TODO: Trigger content strategy update
  console.log('Brand analysis complete:', data);
}

/**
 * POST /api/webhooks/n8n
 * Handles incoming webhooks from n8n workflows
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.text();

    // Get signature from headers
    const signature = request.headers.get('x-n8n-signature');

    // Get webhook secret from environment
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET;

    // Verify signature if secret is configured
    if (webhookSecret) {
      const isValid = verifyWebhookSignature(body, signature, webhookSecret);

      if (!isValid) {
        console.error('Invalid webhook signature');
        return NextResponse.json<WebhookResponse>(
          {
            success: false,
            error: 'Invalid signature'
          },
          { status: 401 }
        );
      }
    } else {
      // Log warning in development
      if (process.env.NODE_ENV === 'development') {
        console.warn('N8N_WEBHOOK_SECRET not configured - skipping signature verification');
      }
    }

    // Parse webhook event
    const event: N8NWebhookEvent = JSON.parse(body);

    // Validate required fields
    if (!event.workflowId || !event.executionId || !event.event) {
      return NextResponse.json<WebhookResponse>(
        {
          success: false,
          error: 'Missing required fields'
        },
        { status: 400 }
      );
    }

    // Process webhook asynchronously
    // Using Promise to not block the response
    processWebhookEvent(event).catch(error => {
      console.error('Error processing webhook event:', error);
      // TODO: Add to retry queue or dead letter queue
    });

    // Return immediate success response
    return NextResponse.json<WebhookResponse>(
      {
        success: true,
        message: 'Webhook received',
        data: {
          workflowId: event.workflowId,
          executionId: event.executionId,
          event: event.event
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Webhook handler error:', error);

    return NextResponse.json<WebhookResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/n8n
 * Health check endpoint for n8n webhook
 */
export async function GET(_request: NextRequest) {
  return NextResponse.json(
    {
      status: 'ok',
      endpoint: '/api/webhooks/n8n',
      timestamp: new Date().toISOString()
    },
    { status: 200 }
  );
}