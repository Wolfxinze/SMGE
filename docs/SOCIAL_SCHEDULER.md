# Social Scheduler - Technical Documentation

## Overview

The Social Scheduler is a comprehensive system for scheduling and publishing content across multiple social media platforms. It provides calendar-based scheduling, automated queue processing, retry logic, and analytics tracking.

**Status:** MVP Completed (Twitter integration live, other platforms stubbed)

## Architecture

### Core Components

1. **Database Layer** (`00005_social_scheduler_schema.sql`)
   - `posts` - Generated content ready for scheduling
   - `scheduled_posts` - Scheduling queue with retry logic
   - `platform_rate_limits` - API rate limit tracking
   - `posting_analytics` - Performance metrics

2. **Platform Abstraction** (`lib/scheduler/platforms/`)
   - `BasePlatform` - Unified interface for all platforms
   - `TwitterPlatform` - Full Twitter/X API v2 implementation
   - Stubs for Instagram, LinkedIn, TikTok, Facebook

3. **Queue Processing** (`lib/scheduler/queue-processor.ts`)
   - `processScheduledPosts()` - Main publishing engine
   - `processRetries()` - Exponential backoff retry logic
   - `fetchAnalytics()` - Performance data collection

4. **API Routes** (`app/api/scheduler/`)
   - OAuth flow initiation and callbacks
   - Post scheduling and management
   - Queue status endpoints

5. **Frontend Components** (`components/scheduler/`)
   - Calendar view with month/week/day displays
   - Queue summary with real-time status
   - Post scheduling interface

## Database Schema

### Posts Table

```sql
CREATE TABLE public.posts (
    id UUID PRIMARY KEY,
    brand_id UUID REFERENCES brands(id),
    user_id UUID REFERENCES auth.users(id),

    -- Content
    content_type VARCHAR(50),  -- post, story, reel, video, article, thread
    title VARCHAR(500),
    body TEXT NOT NULL,
    media_urls JSONB,
    hashtags JSONB,
    mentions JSONB,
    platform_specific_data JSONB,

    -- Status
    status VARCHAR(50),  -- draft, scheduled, publishing, published, failed, cancelled
    approval_status VARCHAR(50),  -- pending, approved, rejected

    -- Timestamps
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ
);
```

### Scheduled Posts Table

```sql
CREATE TABLE public.scheduled_posts (
    id UUID PRIMARY KEY,
    post_id UUID REFERENCES posts(id),
    social_account_id UUID REFERENCES social_accounts(id),
    brand_id UUID REFERENCES brands(id),

    -- Scheduling
    scheduled_for TIMESTAMPTZ NOT NULL,
    timezone VARCHAR(100) DEFAULT 'UTC',

    -- Publishing Status
    status VARCHAR(50),  -- pending, processing, published, failed, cancelled
    platform_post_id TEXT,
    platform_url TEXT,

    -- Error Handling
    error_message TEXT,
    error_code VARCHAR(100),
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMPTZ,

    -- Metadata
    published_at TIMESTAMPTZ,
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ
);
```

### Key Database Functions

**`get_posts_due_for_publishing()`**
- Fetches posts scheduled for publishing in next 5 minutes
- Uses `FOR UPDATE SKIP LOCKED` to prevent concurrent processing
- Atomic operation for queue safety

**`update_scheduled_post_status()`**
- Atomically updates post status
- Calculates retry timing with exponential backoff
- Updates parent post status

**`check_rate_limit()` / `increment_rate_limit()`**
- Enforces platform API rate limits
- Prevents quota violations

## Platform Integration

### BasePlatform Interface

All platform implementations must extend `BasePlatform` and implement:

```typescript
abstract class BasePlatform {
  // Authentication
  abstract validateCredentials(): Promise<boolean>;
  abstract refreshAccessToken(): Promise<PlatformCredentials>;

  // Media
  abstract uploadMedia(urls: string[], type: string): Promise<MediaUploadResult[]>;

  // Publishing
  abstract publishPost(post: Post, data?: PlatformSpecificData): Promise<PublishResult>;
  abstract deletePost(platformPostId: string): Promise<boolean>;

  // Analytics
  abstract fetchAnalytics(platformPostId: string): Promise<Partial<PostingAnalytics>>;

  // Validation
  abstract validateContent(post: Post): Promise<void>;
  abstract getContentLimits(): ContentLimits;
  abstract getRateLimitStatus(endpoint: string): Promise<RateLimitStatus>;
}
```

### Twitter Implementation (Complete)

**Features:**
- OAuth 2.0 with PKCE flow
- Tweet posting with media (up to 4 images)
- Thread support (coming soon)
- Poll creation
- Analytics fetching (impressions, engagement, etc.)
- Automatic token refresh
- Rate limit compliance

**Limitations:**
- Max 280 characters
- Max 4 media items
- Max 300 tweets per 3 hours

**Error Handling:**
- Rate limit detection (429 errors)
- Authentication failures
- Duplicate content detection
- Media upload errors

### Stub Implementations

Instagram, LinkedIn, TikTok, and Facebook platforms are stubbed with proper interfaces but throw "not yet implemented" errors. These can be added incrementally following the Twitter pattern.

## Queue Processing

### Publishing Flow

1. **Cron Trigger** (every 1 minute)
   ```
   Edge Function → processScheduledPosts()
   ```

2. **Fetch Due Posts**
   ```sql
   SELECT * FROM get_posts_due_for_publishing(5)
   FOR UPDATE SKIP LOCKED
   ```

3. **For Each Post:**
   - Mark as "processing"
   - Decrypt social account credentials
   - Get platform instance
   - Upload media (if present)
   - Publish post
   - Update status (published/failed)

4. **Success:**
   - Store platform_post_id and platform_url
   - Mark as "published"
   - Schedule analytics fetch (24 hours later)

5. **Failure:**
   - Store error message and code
   - Increment retry_count
   - Calculate next_retry_at (exponential backoff)
   - Mark as "failed"

### Retry Logic

**Exponential Backoff Schedule:**
- Retry 1: 1 minute after failure
- Retry 2: 5 minutes after failure
- Retry 3: 15 minutes after failure
- Retry 4: 1 hour after failure
- Max retries: 3 (configurable per post)

**Retry Processing:**
- Separate cron job runs `processRetries()` every 5 minutes
- Resets failed posts to "pending" when `next_retry_at` reached
- Main queue processor picks them up

### Rate Limiting

**Platform Limits (enforced):**
- Instagram: 25 posts/day, 100 stories/day
- Twitter: 300 tweets per 3 hours
- LinkedIn: 100 posts/day
- TikTok: 10 videos/day
- Facebook: 50 posts/day

**Implementation:**
- `platform_rate_limits` table tracks usage per account/endpoint
- `check_rate_limit()` called before posting
- `increment_rate_limit()` called after successful post
- Rate limit windows reset automatically

## API Endpoints

### OAuth Flow

**Initiate OAuth**
```
GET /api/scheduler/oauth/:platform?brand_id=xxx
Response: { authorization_url: "https://..." }
```

**OAuth Callback**
```
GET /api/scheduler/oauth/callback/:platform?code=xxx&state=yyy
Redirects to: /profile/social-accounts?success=twitter&account=@username
```

### Scheduling

**Schedule Post**
```
POST /api/scheduler/schedule
Body: {
  post_id: "uuid",
  social_account_ids: ["uuid1", "uuid2"],
  scheduled_for: "2025-01-15T10:00:00Z",
  timezone: "America/New_York"
}
Response: {
  success: true,
  scheduled_posts: [...],
  scheduled_count: 2
}
```

**Get Scheduled Posts**
```
GET /api/scheduler/schedule?brand_id=xxx&start=xxx&end=xxx&status=pending
Response: {
  scheduled_posts: [...],
  count: 10
}
```

**Update Schedule**
```
PATCH /api/scheduler/schedule/:id
Body: {
  scheduled_for: "2025-01-15T14:00:00Z"
}
```

**Cancel Schedule**
```
DELETE /api/scheduler/schedule/:id
Response: { success: true }
```

**Retry Failed Post**
```
POST /api/scheduler/schedule/:id
Response: {
  success: true,
  scheduled_post: {...},
  message: "Post reset for retry"
}
```

## Frontend Components

### SchedulerCalendar

**Features:**
- Month view with all scheduled posts
- Color-coded by platform
- Click day to see details
- Navigate months with arrow keys
- "Today" quick navigation

**Usage:**
```tsx
<SchedulerCalendar />
```

### QueueSummary

**Displays:**
- Pending post count
- Processing post count
- Published today count
- Failed post count (if any)

**Auto-refresh:** Every 30 seconds

**Usage:**
```tsx
<QueueSummary />
```

## Security Considerations

### Token Encryption

All OAuth tokens are encrypted at rest using `pgcrypto`:

```sql
-- Encryption
SELECT pgp_sym_encrypt(token, secret_key);

-- Decryption
SELECT pgp_sym_decrypt(encrypted_token, secret_key);
```

**Environment Variable Required:**
```
SUPABASE_ENCRYPTION_SECRET=your-secret-key-here
```

### Row Level Security (RLS)

All tables enforce RLS policies:
- Users can only access their own posts
- Users can only access scheduled posts for their brands
- Service role can manage rate limits and analytics

### OAuth State Validation

- State parameter includes user_id and brand_id
- Base64url encoded
- 10-minute expiration to prevent replay attacks

## Deployment

### Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ENCRYPTION_SECRET=

# Twitter OAuth
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=

# Instagram OAuth (when implemented)
INSTAGRAM_CLIENT_ID=
INSTAGRAM_CLIENT_SECRET=

# LinkedIn OAuth (when implemented)
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

# TikTok OAuth (when implemented)
TIKTOK_CLIENT_ID=
TIKTOK_CLIENT_SECRET=

# Facebook OAuth (when implemented)
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=

# App Config
NEXT_PUBLIC_APP_URL=https://your-app.com
```

### Database Migration

```bash
# Run migration
supabase migration up

# Verify tables created
supabase db inspect
```

### Edge Functions

**Create Cron Jobs in Supabase Dashboard:**

1. **Queue Processor**
   - Function: `process-scheduled-posts`
   - Schedule: `* * * * *` (every minute)
   - Source: `lib/scheduler/queue-processor.ts::processScheduledPosts`

2. **Retry Processor**
   - Function: `process-retries`
   - Schedule: `*/5 * * * *` (every 5 minutes)
   - Source: `lib/scheduler/queue-processor.ts::processRetries`

3. **Analytics Fetcher**
   - Function: `fetch-analytics`
   - Schedule: `0 */6 * * *` (every 6 hours)
   - Source: `lib/scheduler/queue-processor.ts::fetchAnalytics`

## Testing

### Manual Testing Checklist

- [ ] OAuth flow for Twitter
- [ ] Schedule a test tweet (future time)
- [ ] Verify tweet appears in calendar
- [ ] Wait for scheduled time, verify publication
- [ ] Check analytics fetching (24 hours later)
- [ ] Test failed post retry
- [ ] Test post cancellation
- [ ] Test rescheduling

### Unit Tests (TODO)

```typescript
// Platform tests
describe('TwitterPlatform', () => {
  it('should publish tweet successfully')
  it('should handle rate limit errors')
  it('should retry with exponential backoff')
  it('should fetch analytics correctly')
})

// Queue processor tests
describe('processScheduledPosts', () => {
  it('should process posts due for publishing')
  it('should skip locked posts (concurrent safety)')
  it('should handle platform errors gracefully')
})
```

### E2E Tests (TODO)

```typescript
// Scheduling flow
test('User can schedule a post', async ({ page }) => {
  // Create post
  // Select social accounts
  // Pick date/time
  // Confirm scheduling
  // Verify in calendar
})
```

## Troubleshooting

### Common Issues

**1. "OAuth failed" error**
- Check OAuth credentials are set in environment
- Verify redirect URI matches configured value
- Check state parameter hasn't expired (10 min limit)

**2. Posts not publishing**
- Check Edge Function cron job is running
- Verify social account token hasn't expired
- Check rate limit status
- Review error logs in scheduled_posts table

**3. Rate limit exceeded**
- Check `platform_rate_limits` table
- Wait for rate limit window to reset
- Consider spreading posts across more time

**4. Media upload failures**
- Verify media URL is accessible
- Check media type is supported
- Ensure file size under platform limits

### Debug Queries

```sql
-- Check queue status
SELECT status, COUNT(*)
FROM scheduled_posts
GROUP BY status;

-- Find stuck posts
SELECT * FROM scheduled_posts
WHERE status = 'processing'
AND processing_started_at < NOW() - INTERVAL '10 minutes';

-- Check rate limits
SELECT * FROM platform_rate_limits
WHERE requests_made >= requests_limit;

-- Recent errors
SELECT error_message, error_code, COUNT(*)
FROM scheduled_posts
WHERE status = 'failed'
AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY error_message, error_code;
```

## Future Enhancements

### Phase 1 (Complete)
- [x] Database schema
- [x] Twitter integration
- [x] OAuth flow
- [x] Queue processing
- [x] Retry logic
- [x] Calendar UI
- [x] Basic analytics

### Phase 2 (Next)
- [ ] Instagram integration
- [ ] LinkedIn integration
- [ ] TikTok integration
- [ ] Facebook integration
- [ ] Bulk scheduling
- [ ] Drag-and-drop rescheduling
- [ ] Post preview before scheduling

### Phase 3 (Future)
- [ ] AI-recommended posting times
- [ ] Thread composer
- [ ] Video processing pipeline
- [ ] Advanced analytics dashboard
- [ ] A/B testing framework
- [ ] Webhook notifications for post status

## Contributing

When adding new platform integrations:

1. Extend `BasePlatform` class
2. Implement all abstract methods
3. Add platform-specific types to `types.ts`
4. Update `PlatformFactory.createPlatform()`
5. Add OAuth config to `PlatformOAuthManager`
6. Update rate limits in `PLATFORM_RATE_LIMITS`
7. Add documentation
8. Write tests

## References

- [Twitter API v2 Documentation](https://developer.twitter.com/en/docs/twitter-api)
- [Instagram Graph API](https://developers.facebook.com/docs/instagram-api)
- [LinkedIn API](https://learn.microsoft.com/en-us/linkedin/)
- [TikTok for Developers](https://developers.tiktok.com/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
