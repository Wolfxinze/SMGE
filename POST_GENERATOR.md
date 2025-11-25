# Post Generator Implementation

## Overview
AI-powered social media content generation system that creates brand-consistent posts using the Brand Brain context.

## Features Implemented

### 1. Database Schema (`00005_post_generator_schema.sql`)
- **Posts table**: Stores generated and manual posts with full metadata
- **Post versions table**: Tracks content edits and regenerations
- **RLS policies**: Multi-tenant security with user-level isolation
- **Automatic triggers**: Version tracking and timestamp updates

### 2. AI Generation API (`/api/posts/generate`)
**Endpoint**: `POST /api/posts/generate`

**Features**:
- Brand voice integration from Brand Brain
- Platform-specific content optimization
- Reference content support for style consistency
- Rate limiting (20 requests/min per user)
- OpenAI GPT-4 Turbo integration

**Request Body**:
```json
{
  "brand_id": "uuid",
  "topic": "What the post should be about",
  "platform": "instagram|twitter|linkedin|tiktok|facebook",
  "content_type": "post|story|reel|thread|article",
  "tone": "professional|casual|friendly|formal",
  "max_length": 280,
  "include_hashtags": true,
  "include_call_to_action": false,
  "reference_content_ids": ["uuid1", "uuid2"]
}
```

**Response**:
```json
{
  "post": {
    "id": "uuid",
    "content": "Generated post content...",
    "platform": "instagram",
    "status": "draft",
    ...
  },
  "metadata": {
    "generated_at": "2025-11-25T...",
    "model": "gpt-4-turbo-preview",
    "tokens_used": 256
  }
}
```

### 3. Post Management API (`/api/posts`)

**GET `/api/posts`** - List posts with filtering
- Query params: `brand_id`, `status`, `platform`, `limit`, `offset`
- Returns paginated results

**POST `/api/posts`** - Create manual post
- For non-AI-generated content
- Direct content submission

### 4. UI Component (`PostGeneratorForm`)
**Location**: `components/PostGeneratorForm.tsx`

**Features**:
- Topic input with context
- Platform selection (Instagram, Twitter, LinkedIn, TikTok, Facebook)
- Content type selection
- Hashtag and CTA toggles
- Real-time character count based on platform limits
- Generated content preview and editing
- Save draft / Schedule post actions

**Usage**:
```tsx
import { PostGeneratorForm } from '@/components/PostGeneratorForm'

<PostGeneratorForm
  brandId={brandId}
  onPostGenerated={(post) => console.log('Generated:', post)}
/>
```

## Brand Brain Integration

The Post Generator deeply integrates with Brand Brain to ensure consistency:

1. **Voice Guidelines**: Fetches brand tone, writing style, keywords from `brand_voice` table
2. **Reference Content**: Uses similar content examples for style matching
3. **System Prompts**: Injects brand values and avoid_phrases into AI prompts
4. **Contextual Generation**: Platform-specific adaptations while maintaining brand voice

Example System Prompt Structure:
```
You are a social media content creator for [Brand Name].

Brand Voice Guidelines:
- Tone: professional, friendly
- Style: conversational, storytelling
- Key themes: innovation, customer success
- Avoid: jargon, overly salesy language
- Values: transparency, quality, customer-first

Platform: instagram
Content Type: post
...
```

## Platform-Specific Limits

| Platform  | Max Length | Notes                    |
|-----------|-----------|--------------------------|
| Twitter/X | 280       | Character limit          |
| Instagram | 2,200     | Optimal for engagement   |
| LinkedIn  | 3,000     | Professional context     |
| TikTok    | 2,200     | Video caption limit      |
| Facebook  | 63,206    | Practically unlimited    |

## Database Schema Details

### Posts Table
```sql
CREATE TABLE public.posts (
    id UUID PRIMARY KEY,
    brand_id UUID REFERENCES brands,
    user_id UUID REFERENCES auth.users,
    content TEXT NOT NULL,
    content_type VARCHAR(50),
    platform VARCHAR(50),
    status VARCHAR(50) DEFAULT 'draft',
    scheduled_for TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    -- Analytics fields
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    engagement_rate FLOAT,
    -- Metadata
    generation_prompt TEXT,
    ai_model VARCHAR(100),
    generation_params JSONB,
    ...
)
```

### Post Statuses
- `draft`: Created but not scheduled
- `scheduled`: Queued for publishing
- `publishing`: Currently being posted
- `published`: Successfully posted
- `failed`: Publishing failed

## Rate Limiting

- **Endpoint**: `/api/posts/generate`
- **Limit**: 20 requests per minute per user
- **Headers**: Returns `X-RateLimit-*` headers
- **Response**: 429 Too Many Requests when exceeded

## Future Enhancements

### Phase 2 (n8n Integration)
- Replace direct OpenAI calls with n8n workflow triggers
- Multi-step content refinement workflows
- A/B variant generation
- Content performance prediction

### Phase 3 (Advanced Features)
- Multi-platform adaptation from single topic
- Image generation with Stable Diffusion
- Video script generation
- Thread/carousel post generation
- SEO optimization for LinkedIn articles

## Testing

### Manual Testing
1. Create a brand with Brand Brain setup
2. Generate post via UI form
3. Verify brand voice is reflected in output
4. Test platform-specific character limits
5. Verify drafts save correctly

### API Testing
```bash
# Generate post
curl -X POST http://localhost:3000/api/posts/generate \
  -H "Content-Type: application/json" \
  -d '{
    "brand_id": "your-brand-id",
    "topic": "Announcing our Q4 product updates",
    "platform": "linkedin",
    "include_hashtags": true
  }'

# List posts
curl http://localhost:3000/api/posts?brand_id=your-brand-id
```

## Environment Variables

Required in `.env.local`:
```bash
OPENAI_API_KEY=sk-...
```

## Files Created/Modified

### New Files
1. `supabase/migrations/00005_post_generator_schema.sql`
2. `components/PostGeneratorForm.tsx`
3. `POST_GENERATOR.md`

### Modified Files
1. `app/api/posts/generate/route.ts` (complete implementation)
2. `app/api/posts/route.ts` (GET/POST handlers)
3. `app/api/posts/[id]/route.ts` (placeholder)
4. `app/api/posts/[id]/regenerate/route.ts` (placeholder)

## Integration with Other Systems

- **Brand Brain (Issue #4)**: ✅ Integrated - fetches voice guidelines
- **Social Scheduler (Issue #9)**: 🔄 Ready - posts table has `scheduled_for` field
- **Analytics Dashboard (Issue #11)**: 🔄 Ready - analytics fields in posts table
- **Payment Integration (Issue #6)**: 🔄 Ready - can add usage tracking

## Success Criteria

✅ Database schema supports full post lifecycle
✅ AI generation uses Brand Brain for consistency
✅ Platform-specific content optimization
✅ Rate limiting prevents abuse
✅ UI form is intuitive and responsive
✅ Generated posts saved as drafts
✅ Follows CLAUDE.md principles (simplicity, no over-engineering)

## Known Limitations

1. **No Image Generation**: Text-only for MVP
2. **Single Platform**: Generates for one platform at a time
3. **No n8n Integration**: Direct OpenAI calls (phase 2 feature)
4. **No Analytics**: Post performance tracking is placeholder
5. **No Scheduling UI**: Separate scheduler feature (Issue #9)

## Next Steps

1. Implement regeneration endpoint (`/api/posts/[id]/regenerate`)
2. Add post editing endpoint (`PATCH /api/posts/[id]`)
3. Integrate with Social Scheduler for publishing
4. Add analytics tracking post-publication
5. Connect to n8n workflows for advanced generation
