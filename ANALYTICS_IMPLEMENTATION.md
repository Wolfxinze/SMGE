# Analytics Dashboard Implementation

## Overview
Comprehensive analytics dashboard for tracking social media performance across platforms with AI-powered insights.

## Features Implemented

### 1. Database Schema (Migration 00012)
- **Consolidated Analytics Functions**:
  - `get_dashboard_analytics()` - Overall metrics, platform breakdown, time series, top posts
  - `get_post_analytics()` - Detailed per-post analytics across platforms
  - `get_content_insights()` - Content performance data for AI analysis

- **Optimized Indexes**:
  - Post published date range queries
  - Analytics metrics fetching
  - Platform filtering for scheduled posts

### 2. Backend API Routes

#### `/api/analytics/dashboard`
- **Method**: GET
- **Parameters**:
  - `brand_id` (required)
  - `start_date` (optional, ISO 8601)
  - `end_date` (optional, ISO 8601)
- **Returns**: Consolidated dashboard analytics including:
  - Total posts, reach, impressions, engagement
  - Platform-specific metrics
  - Daily time series data
  - Top performing posts
  - Follower growth

#### `/api/analytics/posts/[id]`
- **Method**: GET
- **Parameters**: `id` (post UUID in URL)
- **Returns**: Detailed post analytics across all platforms:
  - Post content and metadata
  - Platform-specific performance metrics
  - Engagement breakdown (likes, comments, shares, saves)
  - Video metrics (views, watch time)
  - Audience demographics

#### `/api/analytics/insights`
- **Method**: GET
- **Parameters**:
  - `brand_id` (required)
  - `days` (optional, default: 30)
- **Returns**: Raw content insights data:
  - Content type performance
  - Hashtag effectiveness
  - Posting time analysis
  - Platform comparison

#### `/api/analytics/ai-insights`
- **Method**: POST
- **Body**:
  ```json
  {
    "brand_id": "uuid",
    "days": 30,
    "model": "openai" | "claude"
  }
  ```
- **Returns**: AI-generated insights and recommendations:
  - Categorized insights (content, timing, platform, hashtag)
  - Actionable recommendations
  - Priority levels (high, medium, low)

### 3. Frontend Components

#### Reusable Chart Components
- **MetricCard**: Display key metrics with optional trend indicators
- **EngagementChart**: Line chart for time-series engagement data
- **PlatformComparisonChart**: Bar chart comparing platform performance
- **TopPostsTable**: Table showing best performing posts
- **InsightsPanel**: AI-powered recommendations panel

#### Pages
- **`/analytics`**: Main analytics dashboard
  - Brand and date range selector
  - Overview metrics cards
  - Engagement trends chart
  - Platform comparison
  - Top posts list
  - AI insights panel

- **`/analytics/posts/[id]`**: Per-post analytics detail view
  - Post content preview
  - Overall metrics summary
  - Platform-by-platform breakdown
  - Video metrics (if applicable)

### 4. AI Insights Generation

#### Service: `lib/ai/insights-generator.ts`
- **Supported Models**: OpenAI GPT-4, Claude 3.5 Sonnet
- **Analysis Categories**:
  - Content type performance
  - Optimal posting times
  - Platform-specific strategies
  - Hashtag effectiveness
  - Growth opportunities

- **Fallback Logic**: Basic statistical insights if AI fails
- **Helper Functions**:
  - `analyzePostingTimes()` - Find best/worst posting times
  - `formatDayOfWeek()` - Convert day numbers to names
  - `formatHour()` - Convert 24h to 12h format

## Data Flow

### Analytics Dashboard Load
```
User visits /analytics
  → Select brand & date range
  → Fetch /api/analytics/dashboard
    → DB: get_dashboard_analytics()
      → Query posts, scheduled_posts, posting_analytics
      → Aggregate metrics by platform, time
      → Calculate engagement rates
    → Return JSON analytics
  → Render charts and metrics
```

### AI Insights Generation
```
User clicks "Generate Insights"
  → POST /api/analytics/ai-insights
    → DB: get_content_insights()
      → Analyze content types, hashtags, timing, platforms
    → AI: generateInsights()
      → Build analysis prompt
      → Call OpenAI/Claude API
      → Parse JSON response
    → Return categorized insights
  → Display recommendations with priority
```

### Per-Post Analytics
```
User clicks post in dashboard
  → Navigate to /analytics/posts/[id]
  → Fetch /api/analytics/posts/[id]
    → DB: get_post_analytics()
      → Query post details
      → Join scheduled_posts and posting_analytics
      → Return platform-specific metrics
    → Return JSON analytics
  → Render detailed metrics by platform
```

## Database Schema

### Core Tables Used
- **posts**: Content and metadata
- **scheduled_posts**: Platform publishing status
- **posting_analytics**: Performance metrics per platform
- **engagement_analytics**: Daily engagement summaries
- **social_accounts**: Connected platforms and follower counts

### Key Functions
```sql
-- Get comprehensive dashboard analytics
get_dashboard_analytics(
  p_brand_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
) RETURNS JSON

-- Get detailed post analytics
get_post_analytics(
  p_post_id UUID
) RETURNS JSON

-- Get content insights for AI analysis
get_content_insights(
  p_brand_id UUID,
  p_days INTEGER
) RETURNS JSON
```

## Security

### Row Level Security (RLS)
- All analytics queries verify brand ownership
- Functions use `SECURITY DEFINER` with auth checks
- API routes verify user authentication
- Brand access validated on every request

### Authorization Flow
```
API Request
  → Verify auth.uid() exists
  → Query brand with user_id = auth.uid()
  → If brand not found → 403 Forbidden
  → If brand found → Execute query
```

## Performance Optimizations

### Database Indexes
- `idx_posts_brand_published_at` - Date range queries
- `idx_posting_analytics_engagement_rate` - Top posts sorting
- `idx_scheduled_posts_platform_status` - Platform filtering
- `idx_posting_analytics_metrics_fetched_at` - Latest metrics

### Query Optimization
- Aggregation done in database (not app layer)
- JSONB for flexible platform-specific data
- Efficient joins with proper indexes
- `FOR UPDATE SKIP LOCKED` for concurrent safety

## Environment Variables Required

```env
# AI Insights (at least one required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## Usage Examples

### Fetching Dashboard Analytics
```typescript
const response = await fetch(
  `/api/analytics/dashboard?brand_id=${brandId}&start_date=${startDate}&end_date=${endDate}`
);
const data = await response.json();
// data.analytics contains all metrics
```

### Generating AI Insights
```typescript
const response = await fetch('/api/analytics/ai-insights', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    brand_id: brandId,
    days: 30,
    model: 'openai'
  })
});
const data = await response.json();
// data.insights contains AI recommendations
```

### Viewing Post Analytics
```typescript
const response = await fetch(`/api/analytics/posts/${postId}`);
const data = await response.json();
// data.analytics.platforms contains per-platform metrics
```

## Testing

### Manual Testing Checklist
1. **Dashboard Load**:
   - [ ] Metrics display correctly
   - [ ] Charts render with data
   - [ ] Brand selector works
   - [ ] Date range filter works
   - [ ] Refresh button updates data

2. **AI Insights**:
   - [ ] Generate button triggers API call
   - [ ] Insights display with categories
   - [ ] Priority badges show correctly
   - [ ] Fallback insights work without API keys

3. **Post Analytics**:
   - [ ] Post details display correctly
   - [ ] Platform breakdown shows all platforms
   - [ ] Metrics calculate correctly
   - [ ] Back button navigates properly

4. **Error Handling**:
   - [ ] No brand selected shows message
   - [ ] No data shows empty state
   - [ ] API errors display user-friendly messages
   - [ ] Unauthorized access blocked

### Future Enhancements
- [ ] Real-time metrics sync from social platforms
- [ ] Export analytics to CSV/PDF
- [ ] Custom date range picker
- [ ] Competitor benchmarking
- [ ] Scheduled analytics reports
- [ ] A/B testing for content variations
- [ ] Predictive analytics for optimal posting

## Files Modified/Created

### Database
- `supabase/migrations/00012_analytics_dashboard.sql`

### Backend API
- `app/api/analytics/dashboard/route.ts`
- `app/api/analytics/posts/[id]/route.ts`
- `app/api/analytics/insights/route.ts`
- `app/api/analytics/ai-insights/route.ts`

### Frontend Components
- `components/analytics/MetricCard.tsx`
- `components/analytics/EngagementChart.tsx`
- `components/analytics/PlatformComparisonChart.tsx`
- `components/analytics/TopPostsTable.tsx`
- `components/analytics/InsightsPanel.tsx`

### Pages
- `app/(dashboard)/analytics/page.tsx`
- `app/(dashboard)/analytics/posts/[id]/page.tsx`

### AI Service
- `lib/ai/insights-generator.ts`

### Dependencies
- Added `recharts` for data visualization

## Migration Instructions

1. **Apply Database Migration**:
   ```bash
   # If using Supabase CLI
   supabase db push

   # Or apply migration manually in Supabase dashboard
   # SQL Editor → Run migration 00012_analytics_dashboard.sql
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   # recharts already installed
   ```

3. **Set Environment Variables**:
   Add API keys to `.env.local`:
   ```env
   OPENAI_API_KEY=your_key_here
   # OR
   ANTHROPIC_API_KEY=your_key_here
   ```

4. **Verify Setup**:
   ```bash
   npm run type-check
   npm run build
   ```

5. **Test the Dashboard**:
   - Navigate to `/analytics`
   - Select a brand
   - View metrics and charts
   - Generate AI insights
   - Click on a post to view details

## Known Limitations

1. **Data Availability**: Analytics only available for published posts
2. **Platform Sync**: Metrics must be manually synced from social platforms (future enhancement)
3. **AI Costs**: AI insights consume API credits
4. **Historical Data**: Limited by when analytics collection started

## Support

For issues or questions:
1. Check migration was applied: `SELECT * FROM pg_proc WHERE proname LIKE 'get_%_analytics'`
2. Verify RLS policies: `SELECT * FROM pg_policies WHERE tablename IN ('posts', 'posting_analytics')`
3. Check API logs for error messages
4. Ensure environment variables are set correctly
