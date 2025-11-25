-- Post Generator System Schema
-- Migration: 00005_post_generator_schema
-- Description: Schema for AI-generated social media posts with scheduling and analytics

-- ============================================================================
-- POSTS TABLE - Generated and scheduled social media content
-- ============================================================================
CREATE TABLE public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Content
    content TEXT NOT NULL,
    content_type VARCHAR(50) NOT NULL, -- 'post', 'story', 'reel', 'thread', 'article'

    -- Platform targeting
    platform VARCHAR(50) NOT NULL, -- 'instagram', 'twitter', 'linkedin', 'tiktok', 'all'
    platform_specific_data JSONB DEFAULT '{}'::jsonb, -- Platform-specific metadata

    -- Media
    media_urls TEXT[], -- Array of media URLs (images/videos)
    media_metadata JSONB DEFAULT '{}'::jsonb, -- Dimensions, durations, etc.

    -- Generation metadata
    generation_prompt TEXT, -- Original prompt used for generation
    ai_model VARCHAR(100), -- Model used (gpt-4, claude-3-sonnet, etc.)
    generation_params JSONB DEFAULT '{}'::jsonb, -- Temperature, max_tokens, etc.

    -- Scheduling
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'scheduled', 'published', 'failed'
    scheduled_for TIMESTAMPTZ, -- When to publish (null = draft)
    published_at TIMESTAMPTZ, -- Actual publish time

    -- Analytics (populated post-publish)
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    engagement_rate FLOAT,
    analytics_data JSONB DEFAULT '{}'::jsonb,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed')),
    CONSTRAINT valid_platform CHECK (platform IN ('instagram', 'twitter', 'linkedin', 'tiktok', 'facebook', 'all'))
);

-- Indexes for efficient queries
CREATE INDEX idx_posts_brand_id ON public.posts(brand_id);
CREATE INDEX idx_posts_user_id ON public.posts(user_id);
CREATE INDEX idx_posts_status ON public.posts(status);
CREATE INDEX idx_posts_scheduled_for ON public.posts(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX idx_posts_platform ON public.posts(platform);
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);

-- ============================================================================
-- POST VERSIONS TABLE - Track edits and regenerations
-- ============================================================================
CREATE TABLE public.post_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,

    -- Version content
    content TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    change_description TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),

    CONSTRAINT post_versions_unique UNIQUE(post_id, version_number)
);

CREATE INDEX idx_post_versions_post_id ON public.post_versions(post_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_versions ENABLE ROW LEVEL SECURITY;

-- Posts policies
CREATE POLICY "Users can view own posts"
    ON public.posts
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own posts"
    ON public.posts
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
    ON public.posts
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
    ON public.posts
    FOR DELETE
    USING (auth.uid() = user_id);

-- Post versions policies
CREATE POLICY "Users can view versions of own posts"
    ON public.post_versions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.posts
            WHERE posts.id = post_versions.post_id
            AND posts.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create versions for own posts"
    ON public.post_versions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.posts
            WHERE posts.id = post_versions.post_id
            AND posts.user_id = auth.uid()
        )
    );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_updated_at
    BEFORE UPDATE ON public.posts
    FOR EACH ROW
    EXECUTE FUNCTION update_posts_updated_at();

-- Function to create post version on content update
CREATE OR REPLACE FUNCTION create_post_version()
RETURNS TRIGGER AS $$
DECLARE
    v_version_number INTEGER;
BEGIN
    -- Only create version if content actually changed
    IF OLD.content IS DISTINCT FROM NEW.content THEN
        -- Get next version number
        SELECT COALESCE(MAX(version_number), 0) + 1
        INTO v_version_number
        FROM public.post_versions
        WHERE post_id = NEW.id;

        -- Insert new version
        INSERT INTO public.post_versions (
            post_id,
            content,
            version_number,
            created_by
        ) VALUES (
            NEW.id,
            OLD.content, -- Store the OLD content as the version
            v_version_number,
            auth.uid()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER posts_create_version
    BEFORE UPDATE ON public.posts
    FOR EACH ROW
    EXECUTE FUNCTION create_post_version();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.posts IS
    'AI-generated social media posts with scheduling and analytics tracking';

COMMENT ON TABLE public.post_versions IS
    'Version history for edited posts, tracks all content changes';

COMMENT ON COLUMN public.posts.status IS
    'Post lifecycle: draft → scheduled → publishing → published/failed';

COMMENT ON COLUMN public.posts.platform IS
    'Target social platform or "all" for multi-platform';

COMMENT ON COLUMN public.posts.generation_params IS
    'AI generation parameters used (temperature, max_tokens, model settings)';
