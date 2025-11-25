-- Post Generator Schema
-- Migration: 00003_post_generator_schema
-- Description: Tables for AI-powered post generation, templates, and history tracking

-- ============================================================================
-- BRANDS TABLE
-- ============================================================================
-- Brand profiles for multi-brand management
CREATE TABLE IF NOT EXISTS public.brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    industry VARCHAR(100),
    target_audience TEXT,
    brand_voice TEXT,
    brand_values TEXT[],
    logo_url TEXT,
    color_palette JSONB DEFAULT '{}',
    website_url TEXT,
    social_profiles JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on brands
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- Brands policies
CREATE POLICY "Users can manage own brands"
    ON public.brands
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create index for brands
CREATE INDEX idx_brands_user_id ON public.brands(user_id);
CREATE INDEX idx_brands_active ON public.brands(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- POST TEMPLATES TABLE
-- ============================================================================
-- Reusable templates for different types of posts
CREATE TABLE IF NOT EXISTS public.post_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    platform TEXT NOT NULL CHECK (platform IN ('instagram', 'twitter', 'linkedin', 'tiktok', 'all')),
    content_type TEXT NOT NULL CHECK (content_type IN ('post', 'story', 'reel', 'thread', 'carousel')),
    template_structure JSONB NOT NULL DEFAULT '{}',
    tone VARCHAR(50),
    hashtag_strategy JSONB DEFAULT '{"count": 10, "placement": "end"}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- GENERATED POSTS TABLE
-- ============================================================================
-- All AI-generated posts with their content and metadata
CREATE TABLE IF NOT EXISTS public.generated_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
    template_id UUID REFERENCES public.post_templates(id) ON DELETE SET NULL,

    -- Content fields
    content TEXT NOT NULL,
    content_html TEXT, -- For rich text formatting
    hashtags TEXT[], -- Array of hashtags
    mentions TEXT[], -- Array of @mentions

    -- Platform-specific variations
    platform_variants JSONB DEFAULT '{}', -- Stores platform-specific versions

    -- Media attachments
    media_urls JSONB DEFAULT '[]', -- Array of media URLs
    media_type TEXT CHECK (media_type IN ('image', 'video', 'carousel', 'none')),

    -- AI generation metadata
    generation_prompt TEXT,
    generation_model VARCHAR(50) DEFAULT 'gpt-4',
    generation_params JSONB DEFAULT '{}',
    generation_cost DECIMAL(10, 4), -- Track AI API costs

    -- Status tracking
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'scheduled', 'published', 'archived')),
    quality_score DECIMAL(3, 2), -- AI confidence score 0-1

    -- User modifications
    is_edited BOOLEAN DEFAULT FALSE,
    edit_history JSONB DEFAULT '[]', -- Track user edits

    -- Scheduling
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,

    -- Performance metrics (updated after publishing)
    engagement_metrics JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- GENERATION HISTORY TABLE
-- ============================================================================
-- Track all generation attempts for analytics and improvement
CREATE TABLE IF NOT EXISTS public.generation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.generated_posts(id) ON DELETE CASCADE,

    -- Request details
    request_type TEXT NOT NULL CHECK (request_type IN ('generate', 'regenerate', 'enhance', 'translate')),
    request_payload JSONB NOT NULL,

    -- Response details
    response_content TEXT,
    response_metadata JSONB DEFAULT '{}',

    -- Execution details
    workflow_execution_id VARCHAR(255), -- n8n execution ID
    ai_model VARCHAR(50),
    tokens_used INTEGER,
    latency_ms INTEGER,
    cost DECIMAL(10, 4),

    -- Status
    status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'timeout')),
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- POST MEDIA TABLE
-- ============================================================================
-- Store generated images and media for posts
CREATE TABLE IF NOT EXISTS public.post_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.generated_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- Media details
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'gif')),
    media_url TEXT NOT NULL,
    thumbnail_url TEXT,
    storage_path TEXT, -- Supabase storage path

    -- Generation metadata
    generation_prompt TEXT,
    generation_model VARCHAR(50), -- e.g., 'stable-diffusion', 'dall-e-3'
    generation_params JSONB DEFAULT '{}',

    -- Media properties
    width INTEGER,
    height INTEGER,
    duration_seconds INTEGER, -- For videos
    file_size_bytes BIGINT,
    mime_type VARCHAR(50),

    -- Alt text for accessibility
    alt_text TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CONTENT PILLARS TABLE
-- ============================================================================
-- Define content categories for organized posting strategy
CREATE TABLE IF NOT EXISTS public.content_pillars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE,

    name VARCHAR(100) NOT NULL,
    description TEXT,
    keywords TEXT[],
    tone VARCHAR(50),
    emoji VARCHAR(10),
    color VARCHAR(7), -- Hex color for UI

    -- Content guidelines
    guidelines JSONB DEFAULT '{}',
    example_posts JSONB DEFAULT '[]',

    -- Usage tracking
    post_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Post templates indexes
CREATE INDEX idx_post_templates_user_id ON public.post_templates(user_id);
CREATE INDEX idx_post_templates_platform ON public.post_templates(platform) WHERE is_active = TRUE;
CREATE INDEX idx_post_templates_content_type ON public.post_templates(content_type);

-- Generated posts indexes
CREATE INDEX idx_generated_posts_user_id ON public.generated_posts(user_id);
CREATE INDEX idx_generated_posts_brand_id ON public.generated_posts(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX idx_generated_posts_status ON public.generated_posts(status);
CREATE INDEX idx_generated_posts_scheduled ON public.generated_posts(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_generated_posts_created ON public.generated_posts(created_at DESC);

-- Generation history indexes
CREATE INDEX idx_generation_history_user_id ON public.generation_history(user_id);
CREATE INDEX idx_generation_history_post_id ON public.generation_history(post_id) WHERE post_id IS NOT NULL;
CREATE INDEX idx_generation_history_status ON public.generation_history(status);
CREATE INDEX idx_generation_history_created ON public.generation_history(created_at DESC);

-- Post media indexes
CREATE INDEX idx_post_media_post_id ON public.post_media(post_id);
CREATE INDEX idx_post_media_user_id ON public.post_media(user_id);

-- Content pillars indexes
CREATE INDEX idx_content_pillars_user_id ON public.content_pillars(user_id);
CREATE INDEX idx_content_pillars_brand_id ON public.content_pillars(brand_id) WHERE brand_id IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.post_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_pillars ENABLE ROW LEVEL SECURITY;

-- Post templates policies
CREATE POLICY "Users can manage own post templates"
    ON public.post_templates
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Generated posts policies
CREATE POLICY "Users can manage own generated posts"
    ON public.generated_posts
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Generation history policies
CREATE POLICY "Users can view own generation history"
    ON public.generation_history
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert generation history"
    ON public.generation_history
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Post media policies
CREATE POLICY "Users can manage own post media"
    ON public.post_media
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Content pillars policies
CREATE POLICY "Users can manage own content pillars"
    ON public.content_pillars
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_post_generator_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_post_templates_timestamp
    BEFORE UPDATE ON public.post_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_post_generator_timestamp();

CREATE TRIGGER update_generated_posts_timestamp
    BEFORE UPDATE ON public.generated_posts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_post_generator_timestamp();

CREATE TRIGGER update_content_pillars_timestamp
    BEFORE UPDATE ON public.content_pillars
    FOR EACH ROW
    EXECUTE FUNCTION public.update_post_generator_timestamp();

-- Function to track post edits
CREATE OR REPLACE FUNCTION public.track_post_edit()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.content IS DISTINCT FROM NEW.content OR
       OLD.hashtags IS DISTINCT FROM NEW.hashtags OR
       OLD.platform_variants IS DISTINCT FROM NEW.platform_variants THEN

        NEW.is_edited = TRUE;
        NEW.edit_history = NEW.edit_history || jsonb_build_object(
            'timestamp', NOW(),
            'changes', jsonb_build_object(
                'content', CASE WHEN OLD.content IS DISTINCT FROM NEW.content THEN TRUE ELSE FALSE END,
                'hashtags', CASE WHEN OLD.hashtags IS DISTINCT FROM NEW.hashtags THEN TRUE ELSE FALSE END,
                'platform_variants', CASE WHEN OLD.platform_variants IS DISTINCT FROM NEW.platform_variants THEN TRUE ELSE FALSE END
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to track edits
CREATE TRIGGER track_generated_post_edits
    BEFORE UPDATE ON public.generated_posts
    FOR EACH ROW
    EXECUTE FUNCTION public.track_post_edit();

-- Function to increment content pillar usage
CREATE OR REPLACE FUNCTION public.increment_pillar_usage(pillar_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.content_pillars
    SET
        post_count = post_count + 1,
        last_used_at = NOW()
    WHERE id = pillar_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.post_templates IS 'Reusable templates for generating social media posts';
COMMENT ON TABLE public.generated_posts IS 'AI-generated social media posts with platform variants';
COMMENT ON TABLE public.generation_history IS 'History of all post generation attempts for analytics';
COMMENT ON TABLE public.post_media IS 'Media files generated for posts';
COMMENT ON TABLE public.content_pillars IS 'Content categories for organized posting strategy';

COMMENT ON COLUMN public.generated_posts.platform_variants IS 'Platform-specific versions of the post content';
COMMENT ON COLUMN public.generated_posts.quality_score IS 'AI confidence score for the generated content (0-1)';
COMMENT ON COLUMN public.generation_history.workflow_execution_id IS 'n8n workflow execution ID for tracking';
COMMENT ON COLUMN public.post_media.storage_path IS 'Supabase storage bucket path for the media file';