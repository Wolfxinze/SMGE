# Engagement Agent Documentation

## Overview

The Engagement Agent is an AI-powered system that monitors social media comments and DMs, generates contextual responses using Brand Brain, and provides an approval queue for human oversight before posting.

## Architecture

```
Social Platform → n8n Webhook → API Webhook → Engagement Item
                                                    ↓
                                            Sentiment Analysis
                                                    ↓
                                            AI Response Generation
                                                    ↓
                                            Approval Queue UI
                                                    ↓
                                        User Approves/Edits/Rejects
                                                    ↓
                                            Post to Platform
                                                    ↓
                                            Engagement History
```

## Database Schema

### Tables

#### `engagement_items`
Stores incoming comments/DMs to respond to.

**Key Fields:**
- `platform`: Social platform (instagram, twitter, linkedin, tiktok)
- `engagement_type`: Type (comment, dm, mention, reply)
- `content`: The comment/DM text
- `sentiment`: AI-analyzed sentiment (positive, neutral, negative, urgent)
- `priority`: Response priority (low, normal, high, urgent)
- `status`: Processing status (pending, processing, responded, ignored, failed)

#### `generated_responses`
Stores AI-generated responses awaiting approval.

**Key Fields:**
- `response_text`: AI-generated reply
- `ai_model`: Model used (gpt-4, claude-3.5-sonnet)
- `approval_status`: Approval state (pending, approved, rejected, edited)
- `posting_status`: Posting state (queued, posting, posted, failed)
- `brand_voice_similarity`: Similarity score to brand voice (0-1)

#### `engagement_history`
Historical record of posted responses with performance metrics.

**Key Fields:**
- `response_text`: Final text that was posted
- `was_edited`: Whether user edited the AI response
- `response_time_minutes`: Time from original comment to response
- `likes_count`, `replies_count`, `reach`: Performance metrics

#### `engagement_rules`
Automated rules for filtering and auto-approving responses.

**Key Fields:**
- `conditions`: Matching conditions (keywords, sentiment, platforms)
- `action`: Action to take (auto_approve, auto_ignore, flag_urgent)
- `response_template`: Template with variables like {author_name}

## API Endpoints

### `POST /api/engagement/items`
Create new engagement item.

**Request:**
```json
{
  "brand_id": "uuid",
  "platform": "instagram",
  "social_account_id": "uuid",
  "engagement_type": "comment",
  "external_id": "platform_comment_id",
  "author_username": "john_doe",
  "content": "Great post! Love your content.",
  "original_post_content": "Our latest product launch..."
}
```

**Response:**
```json
{
  "item": {
    "id": "uuid",
    "sentiment": "positive",
    "priority": "normal",
    "status": "pending"
  }
}
```

### `GET /api/engagement/items?brand_id=uuid`
List engagement items with optional filters.

**Query Parameters:**
- `brand_id` (required): Brand UUID
- `status`: Filter by status
- `priority`: Filter by priority
- `platform`: Filter by platform
- `limit`: Max results (default: 50)

### `POST /api/engagement/generate`
Generate AI response for an engagement item.

**Request:**
```json
{
  "engagement_item_id": "uuid",
  "brand_id": "uuid",
  "variant_count": 1
}
```

**Response:**
```json
{
  "responses": [{
    "id": "uuid",
    "response_text": "Thank you so much! We're glad you love it...",
    "ai_model": "gpt-4",
    "brand_voice_similarity": 0.87
  }]
}
```

### `GET /api/engagement/queue?brand_id=uuid`
Get approval queue for a brand.

**Response:**
```json
{
  "queue": [{
    "engagement_id": "uuid",
    "response_id": "uuid",
    "author_username": "john_doe",
    "content": "Original comment",
    "response_text": "AI-generated response",
    "sentiment": "positive",
    "priority": "normal",
    "created_at": "2025-11-25T10:30:00Z"
  }]
}
```

### `POST /api/engagement/approve`
Approve a response (with optional edits).

**Request:**
```json
{
  "response_id": "uuid",
  "edited_text": "Edited response (optional)"
}
```

### `DELETE /api/engagement/approve`
Reject a response.

**Request:**
```json
{
  "response_id": "uuid",
  "reason": "Not appropriate for brand voice"
}
```

### `GET /api/engagement/analytics?brand_id=uuid&days=30`
Get engagement analytics.

**Response:**
```json
{
  "analytics": {
    "total_engagement_items": 150,
    "pending_responses": 12,
    "approved_responses": 85,
    "posted_responses": 80,
    "avg_response_time_minutes": 45,
    "sentiment_distribution": {
      "positive": 90,
      "neutral": 40,
      "negative": 20
    },
    "platform_distribution": {
      "instagram": 100,
      "twitter": 30,
      "linkedin": 20
    }
  }
}
```

### `POST /api/engagement/webhook`
Webhook endpoint for n8n workflows.

**Headers:**
- `x-webhook-secret`: Webhook authentication secret

**Request:**
```json
{
  "platform": "instagram",
  "social_account_id": "uuid",
  "event_type": "comment",
  "data": {
    "id": "platform_comment_id",
    "from": {
      "username": "john_doe",
      "name": "John Doe"
    },
    "text": "Great post!",
    "media_id": "post_id"
  }
}
```

## AI Response Generation

### Brand Brain Integration

The Engagement Agent uses the Brand Brain system to generate responses that match brand voice:

1. **Context Retrieval**: Fetches brand mission, voice tone, personality traits, and example content
2. **Prompt Engineering**: Builds context-rich prompts with brand guidelines
3. **Response Generation**: Uses GPT-4 or Claude 3.5 Sonnet
4. **Voice Similarity**: Calculates embedding similarity to ensure brand alignment

### Sentiment Analysis

Incoming engagement is analyzed for:
- **Sentiment**: positive, neutral, negative, urgent
- **Sentiment Score**: -1.0 (very negative) to 1.0 (very positive)
- **Intent**: customer_service, compliment, question, complaint, spam

### Priority Calculation

Priority is automatically calculated based on:
- Sentiment (urgent/negative = high priority)
- Author influence (>10k followers = high priority)
- Detected intent (customer_service = urgent)

## Social Platform Integration

### Supported Platforms

- **Instagram**: Comments and DM replies via Graph API
- **Twitter**: Replies and mentions via API v2
- **LinkedIn**: Comment replies via API
- **TikTok**: Comment replies via TikTok API

### Rate Limiting

Each platform has rate limits enforced:
- Instagram: 200 requests/hour per user
- Twitter: 300 requests/15 minutes
- LinkedIn: 100 requests/day per app
- TikTok: 500 requests/day per app

Rate limiting is handled in the posting service with exponential backoff retry logic.

### Retry Logic

Failed postings are retried with exponential backoff:
- Retry 1: 5 minutes
- Retry 2: 10 minutes
- Retry 3: 20 minutes
- Retry 4: 40 minutes
- Retry 5: 80 minutes (max)

After 5 failed retries, the response is marked as permanently failed.

## n8n Workflow Integration

### Monitoring Workflow

The n8n monitoring workflow should:

1. Poll social platform APIs for new engagement (every 5 minutes)
2. Extract engagement data (comment text, author, post context)
3. POST to `/api/engagement/webhook` with standardized payload
4. Handle webhook response and log results

**Example n8n Nodes:**
- **Schedule Trigger**: Every 5 minutes
- **HTTP Request**: GET Instagram comments
- **Function**: Transform to standard format
- **Webhook**: POST to `/api/engagement/webhook`

### Auto-Response Workflow

For approved responses, the posting workflow:

1. Receives posting trigger from approval endpoint
2. Fetches response details from database
3. Calls platform-specific posting function
4. Updates engagement history with results

## Security Considerations

### Multi-Tenant Isolation

All database queries enforce user ownership:
- Engagement items filtered by `brand_id` → `user_id`
- Row Level Security (RLS) policies prevent cross-tenant access
- API endpoints verify brand ownership before operations

### Token Encryption

Social account tokens are encrypted at rest:
- Uses `pgcrypto` extension for encryption
- Tokens encrypted with `SUPABASE_ENCRYPTION_SECRET`
- Decryption only occurs during posting operations

### Webhook Security

Webhook endpoint requires authentication:
- `x-webhook-secret` header must match `N8N_WEBHOOK_SECRET`
- Invalid secrets return 401 Unauthorized
- Webhook payloads validated before processing

## Environment Variables

Required environment variables:

```env
# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Supabase
SUPABASE_URL=https://...supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ENCRYPTION_SECRET=your-encryption-secret

# n8n
N8N_WEBHOOK_SECRET=your-webhook-secret

# Social Platform APIs
INSTAGRAM_APP_ID=...
INSTAGRAM_APP_SECRET=...
TWITTER_API_KEY=...
TWITTER_API_SECRET=...
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...
```

## Testing

### Manual Testing

1. **Create Test Engagement Item:**
   ```bash
   curl -X POST http://localhost:3000/api/engagement/items \
     -H "Content-Type: application/json" \
     -d '{
       "brand_id": "your-brand-id",
       "platform": "instagram",
       "social_account_id": "your-account-id",
       "engagement_type": "comment",
       "external_id": "test-comment-123",
       "author_username": "test_user",
       "content": "Great post! Love your content.",
       "original_post_content": "Our latest product launch..."
     }'
   ```

2. **Generate Response:**
   ```bash
   curl -X POST http://localhost:3000/api/engagement/generate \
     -H "Content-Type: application/json" \
     -d '{
       "engagement_item_id": "engagement-id",
       "brand_id": "your-brand-id"
     }'
   ```

3. **View Approval Queue:**
   ```bash
   curl http://localhost:3000/api/engagement/queue?brand_id=your-brand-id
   ```

4. **Approve Response:**
   ```bash
   curl -X POST http://localhost:3000/api/engagement/approve \
     -H "Content-Type: application/json" \
     -d '{
       "response_id": "response-id"
     }'
   ```

### E2E Testing

TODO: Add Playwright tests for:
- Engagement item creation flow
- Response generation and approval workflow
- Posting retry logic
- Multi-tenant isolation

## Monitoring & Observability

### Metrics to Track

- Engagement items received per hour
- Average sentiment score
- Response generation latency
- Approval queue size
- Posting success rate
- Average response time (comment → posted reply)

### Logging

Key events logged:
- Webhook received
- Engagement item created
- Response generated
- Response approved/rejected
- Posting succeeded/failed
- Retry scheduled

## Future Enhancements

1. **Real-time Notifications**: Push notifications for urgent engagement
2. **Bulk Approval**: Approve multiple responses at once
3. **Auto-Approve Rules**: Smart rules for auto-approving simple responses
4. **Response Learning**: Learn from user edits to improve future generations
5. **Influencer Detection**: Automatically detect and prioritize influencer engagement
6. **Conversation Threading**: Track multi-turn conversations
7. **Performance Analytics**: Track which responses perform best (likes, replies)
8. **A/B Testing**: Generate multiple variants and test performance

## Troubleshooting

### Response Not Generated

1. Check Brand Brain is set up for the brand
2. Verify OpenAI/Anthropic API keys are valid
3. Check engagement item status is 'pending'
4. Review logs for AI service errors

### Posting Failed

1. Verify social account tokens are valid
2. Check platform rate limits
3. Review posting error message
4. Verify external_id format is correct
5. Check if post/comment still exists on platform

### Webhook Not Receiving Events

1. Verify webhook secret matches
2. Check n8n workflow is running
3. Review n8n execution logs
4. Test webhook endpoint directly with curl
5. Verify social account webhooks are configured

## Support

For issues or questions:
- GitHub Issues: https://github.com/Wolfxinze/SMGE/issues
- Documentation: https://github.com/Wolfxinze/SMGE/docs
