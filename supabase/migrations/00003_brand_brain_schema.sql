-- Brand Brain System Schema
-- Migration: 00003_brand_brain_schema
-- Description: Core Brand Brain tables for storing brand context, voice, guidelines, and content examples
-- Features: pgvector for similarity search, comprehensive RLS policies, multi-tenant support

-- ============================================================================
-- ENABLE EXTENSIONS
-- ============================================================================
-- Enable pgvector extension for embedding-based similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- BRANDS TABLE - Core brand information
-- ============================================================================
-- Central table storing brand identity and business context
CREATE TABLE public.brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Basic Information
    name VARCHAR(255) NOT NULL,
    tagline TEXT,
    website VARCHAR(500),
    industry VARCHAR(100),

    -- Brand Identity
    description TEXT,
    mission TEXT,
    vision TEXT,
    values JSONB DEFAULT '[]'::jsonb, -- Array of value objects: [{name, description}]

    -- Business Context
    unique_selling_points JSONB DEFAULT '[]'::jsonb, -- Array of USPs
    competitors JSONB DEFAULT '[]'::jsonb, -- Array of competitor info: [{name, url, notes}]

    -- Status
    is_active BOOLEAN DEFAULT true,
    onboarding_completed BOOLEAN DEFAULT false,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT brands_name_user_unique UNIQUE(user_id, name)
);

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_brands_user_id ON public.brands(user_id);
CREATE INDEX IF NOT EXISTS idx_brands_is_active ON public.brands(is_active);

-- Add comment
COMMENT ON TABLE public.brands IS 'Core brand information including mission, vision, values, and business context';

-- ============================================================================
-- BRAND_VOICE TABLE - Tone and communication style
-- ============================================================================
-- Defines how the brand communicates
CREATE TABLE public.brand_voice (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,

    -- Voice Characteristics
    tone JSONB DEFAULT '{}'::jsonb, -- {professional: 0.8, friendly: 0.6, authoritative: 0.4}
    personality_traits JSONB DEFAULT '[]'::jsonb, -- ["innovative", "trustworthy", "approachable"]

    -- Communication Style
    vocabulary_level VARCHAR(50), -- "simple", "moderate", "advanced", "technical"
    sentence_structure VARCHAR(50), -- "short", "varied", "complex"

    -- Language Patterns
    preferred_phrases JSONB DEFAULT '[]'::jsonb, -- Common phrases the brand uses
    avoided_phrases JSONB DEFAULT '[]'::jsonb, -- Phrases to avoid

    -- Style Guide
    writing_style TEXT, -- Detailed style guide
    grammar_preferences JSONB DEFAULT '{}'::jsonb, -- {oxford_comma: true, contractions: false}

    -- Messaging Framework
    key_messages JSONB DEFAULT '[]'::jsonb, -- Core messages to reinforce
    storytelling_themes JSONB DEFAULT '[]'::jsonb, -- Recurring narrative themes

    -- AI Embeddings for similarity matching
    voice_embedding VECTOR(1536), -- OpenAI ada-002 embeddings

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure one voice profile per brand
    CONSTRAINT brand_voice_brand_unique UNIQUE(brand_id)
);

-- Create vector similarity search index
CREATE INDEX IF NOT EXISTS idx_brand_voice_embedding ON public.brand_voice
    USING ivfflat (voice_embedding vector_cosine_ops)
    WITH (lists = 100);

-- Create standard indexes
CREATE INDEX IF NOT EXISTS idx_brand_voice_brand_id ON public.brand_voice(brand_id);

-- Add comment
COMMENT ON TABLE public.brand_voice IS 'Brand voice characteristics, tone, and communication style with AI embeddings';

-- ============================================================================
-- TARGET_AUDIENCES TABLE - Audience personas
-- ============================================================================
-- Detailed audience segments and personas
CREATE TABLE public.target_audiences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,

    -- Persona Identification
    persona_name VARCHAR(255) NOT NULL, -- "Tech-Savvy Millennials"
    is_primary BOOLEAN DEFAULT false, -- Primary vs secondary audience

    -- Demographics
    demographics JSONB DEFAULT '{}'::jsonb, -- {age_range: "25-34", gender: "all", income: "$50k-$100k", education: "college", location: "urban"}

    -- Psychographics
    psychographics JSONB DEFAULT '{}'::jsonb, -- {interests: [], values: [], lifestyle: "", personality: {}}

    -- Behavioral Patterns
    online_behavior JSONB DEFAULT '{}'::jsonb, -- {platforms: [], content_preferences: [], peak_times: []}
    purchase_behavior JSONB DEFAULT '{}'::jsonb, -- {frequency: "", decision_factors: [], budget: ""}

    -- Needs and Motivations
    pain_points JSONB DEFAULT '[]'::jsonb, -- Array of challenges they face
    goals JSONB DEFAULT '[]'::jsonb, -- What they want to achieve
    motivations JSONB DEFAULT '[]'::jsonb, -- What drives them

    -- Communication Preferences
    preferred_channels JSONB DEFAULT '[]'::jsonb, -- ["instagram", "email", "linkedin"]
    content_types JSONB DEFAULT '[]'::jsonb, -- ["video", "infographics", "long-form"]
    messaging_preferences TEXT, -- How to speak to this audience

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_target_audiences_brand_id ON public.target_audiences(brand_id);
CREATE INDEX IF NOT EXISTS idx_target_audiences_is_primary ON public.target_audiences(is_primary);

-- Add comment
COMMENT ON TABLE public.target_audiences IS 'Detailed audience personas including demographics, psychographics, and behavioral patterns';

-- ============================================================================
-- BRAND_CONTENT_EXAMPLES TABLE - Example content for learning
-- ============================================================================
-- Sample content that represents the brand well
CREATE TABLE public.brand_content_examples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,

    -- Content Classification
    content_type VARCHAR(50) NOT NULL, -- "post", "story", "reel", "article", "email"
    platform VARCHAR(50), -- "instagram", "linkedin", "twitter", "blog"
    category VARCHAR(100), -- "educational", "promotional", "engagement", "thought-leadership"

    -- Content Details
    title VARCHAR(500),
    content TEXT NOT NULL, -- The actual content/copy

    -- Performance Metrics (if available)
    metrics JSONB DEFAULT '{}'::jsonb, -- {likes: 1000, shares: 50, engagement_rate: 0.05}

    -- Context
    context TEXT, -- When/why this content worked well
    key_elements JSONB DEFAULT '[]'::jsonb, -- What made this content effective

    -- Media References
    media_urls JSONB DEFAULT '[]'::jsonb, -- Links to images/videos if applicable
    hashtags JSONB DEFAULT '[]'::jsonb, -- Hashtags used

    -- AI Embeddings for similarity search
    embedding VECTOR(1536), -- OpenAI ada-002 embeddings

    -- Quality Indicators
    is_top_performer BOOLEAN DEFAULT false,
    approval_status VARCHAR(50) DEFAULT 'approved', -- "draft", "approved", "archived"

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create vector similarity search index
CREATE INDEX IF NOT EXISTS idx_brand_content_examples_embedding ON public.brand_content_examples
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Create standard indexes
CREATE INDEX IF NOT EXISTS idx_brand_content_examples_brand_id ON public.brand_content_examples(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_content_examples_content_type ON public.brand_content_examples(content_type);
CREATE INDEX IF NOT EXISTS idx_brand_content_examples_platform ON public.brand_content_examples(platform);
CREATE INDEX IF NOT EXISTS idx_brand_content_examples_is_top_performer ON public.brand_content_examples(is_top_performer);

-- Add comment
COMMENT ON TABLE public.brand_content_examples IS 'Example content representing brand voice and style with AI embeddings for similarity matching';

-- ============================================================================
-- BRAND_GUIDELINES TABLE - Visual and content guidelines
-- ============================================================================
-- Visual identity and content creation rules
CREATE TABLE public.brand_guidelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,

    -- Visual Identity
    colors JSONB DEFAULT '{}'::jsonb, -- {primary: "#FF5733", secondary: ["#333333"], accent: "#00BCD4"}
    typography JSONB DEFAULT '{}'::jsonb, -- {heading: "Montserrat", body: "Open Sans", sizes: {}}

    -- Logo Guidelines
    logo_urls JSONB DEFAULT '{}'::jsonb, -- {primary: "url", variations: {dark: "url", light: "url"}}
    logo_usage_rules TEXT, -- How to properly use the logo

    -- Imagery Style
    imagery_style JSONB DEFAULT '{}'::jsonb, -- {style: "modern", mood: "professional", filters: {}}
    photo_guidelines TEXT, -- Types of photos to use/avoid
    illustration_style TEXT, -- If applicable

    -- Content Rules
    content_dos JSONB DEFAULT '[]'::jsonb, -- Best practices
    content_donts JSONB DEFAULT '[]'::jsonb, -- Things to avoid

    -- Platform-Specific Guidelines
    platform_guidelines JSONB DEFAULT '{}'::jsonb, -- {instagram: {post_types: [], hashtag_count: 10}, linkedin: {}}

    -- Templates and Patterns
    content_templates JSONB DEFAULT '{}'::jsonb, -- {post: "template", story: "template"}
    hashtag_banks JSONB DEFAULT '{}'::jsonb, -- {branded: [], community: [], campaign: []}

    -- Legal and Compliance
    legal_requirements TEXT, -- Disclaimers, disclosures
    compliance_notes JSONB DEFAULT '{}'::jsonb, -- Industry-specific compliance

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure one guideline set per brand
    CONSTRAINT brand_guidelines_brand_unique UNIQUE(brand_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_brand_guidelines_brand_id ON public.brand_guidelines(brand_id);

-- Add comment
COMMENT ON TABLE public.brand_guidelines IS 'Visual identity, content rules, and platform-specific guidelines';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_voice ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.target_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_content_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_guidelines ENABLE ROW LEVEL SECURITY;

-- ===================
-- BRANDS TABLE POLICIES
-- ===================

-- Users can view their own brands
DROP POLICY IF EXISTS "Users can view own brands" ON public.brands;
CREATE POLICY "Users can view own brands"
    ON public.brands FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own brands
DROP POLICY IF EXISTS "Users can create own brands" ON public.brands;
CREATE POLICY "Users can create own brands"
    ON public.brands FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own brands
DROP POLICY IF EXISTS "Users can update own brands" ON public.brands;
CREATE POLICY "Users can update own brands"
    ON public.brands FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own brands
DROP POLICY IF EXISTS "Users can delete own brands" ON public.brands;
CREATE POLICY "Users can delete own brands"
    ON public.brands FOR DELETE
    USING (auth.uid() = user_id);

-- ===================
-- BRAND_VOICE TABLE POLICIES
-- ===================

-- Users can view voice profiles for their brands
DROP POLICY IF EXISTS "Users can view own brand voice" ON public.brand_voice;
CREATE POLICY "Users can view own brand voice"
    ON public.brand_voice FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = brand_voice.brand_id
            AND brands.user_id = auth.uid()
        )
    );

-- Users can create voice profiles for their brands
DROP POLICY IF EXISTS "Users can create own brand voice" ON public.brand_voice;
CREATE POLICY "Users can create own brand voice"
    ON public.brand_voice FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = brand_voice.brand_id
            AND brands.user_id = auth.uid()
        )
    );

-- Users can update voice profiles for their brands
DROP POLICY IF EXISTS "Users can update own brand voice" ON public.brand_voice;
CREATE POLICY "Users can update own brand voice"
    ON public.brand_voice FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = brand_voice.brand_id
            AND brands.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = brand_voice.brand_id
            AND brands.user_id = auth.uid()
        )
    );

-- Users can delete voice profiles for their brands
DROP POLICY IF EXISTS "Users can delete own brand voice" ON public.brand_voice;
CREATE POLICY "Users can delete own brand voice"
    ON public.brand_voice FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = brand_voice.brand_id
            AND brands.user_id = auth.uid()
        )
    );

-- ===================
-- TARGET_AUDIENCES TABLE POLICIES
-- ===================

-- Users can view audiences for their brands
DROP POLICY IF EXISTS "Users can view own brand audiences" ON public.target_audiences;
CREATE POLICY "Users can view own brand audiences"
    ON public.target_audiences FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = target_audiences.brand_id
            AND brands.user_id = auth.uid()
        )
    );

-- Users can create audiences for their brands
DROP POLICY IF EXISTS "Users can create own brand audiences" ON public.target_audiences;
CREATE POLICY "Users can create own brand audiences"
    ON public.target_audiences FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = target_audiences.brand_id
            AND brands.user_id = auth.uid()
        )
    );

-- Users can update audiences for their brands
DROP POLICY IF EXISTS "Users can update own brand audiences" ON public.target_audiences;
CREATE POLICY "Users can update own brand audiences"
    ON public.target_audiences FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = target_audiences.brand_id
            AND brands.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = target_audiences.brand_id
            AND brands.user_id = auth.uid()
        )
    );

-- Users can delete audiences for their brands
DROP POLICY IF EXISTS "Users can delete own brand audiences" ON public.target_audiences;
CREATE POLICY "Users can delete own brand audiences"
    ON public.target_audiences FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = target_audiences.brand_id
            AND brands.user_id = auth.uid()
        )
    );

-- ===================
-- BRAND_CONTENT_EXAMPLES TABLE POLICIES
-- ===================

-- Users can view content examples for their brands
DROP POLICY IF EXISTS "Users can view own brand content examples" ON public.brand_content_examples;
CREATE POLICY "Users can view own brand content examples"
    ON public.brand_content_examples FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = brand_content_examples.brand_id
            AND brands.user_id = auth.uid()
        )
    );

-- Users can create content examples for their brands
DROP POLICY IF EXISTS "Users can create own brand content examples" ON public.brand_content_examples;
CREATE POLICY "Users can create own brand content examples"
    ON public.brand_content_examples FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = brand_content_examples.brand_id
            AND brands.user_id = auth.uid()
        )
    );

-- Users can update content examples for their brands
DROP POLICY IF EXISTS "Users can update own brand content examples" ON public.brand_content_examples;
CREATE POLICY "Users can update own brand content examples"
    ON public.brand_content_examples FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = brand_content_examples.brand_id
            AND brands.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = brand_content_examples.brand_id
            AND brands.user_id = auth.uid()
        )
    );

-- Users can delete content examples for their brands
DROP POLICY IF EXISTS "Users can delete own brand content examples" ON public.brand_content_examples;
CREATE POLICY "Users can delete own brand content examples"
    ON public.brand_content_examples FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = brand_content_examples.brand_id
            AND brands.user_id = auth.uid()
        )
    );

-- ===================
-- BRAND_GUIDELINES TABLE POLICIES
-- ===================

-- Users can view guidelines for their brands
DROP POLICY IF EXISTS "Users can view own brand guidelines" ON public.brand_guidelines;
CREATE POLICY "Users can view own brand guidelines"
    ON public.brand_guidelines FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = brand_guidelines.brand_id
            AND brands.user_id = auth.uid()
        )
    );

-- Users can create guidelines for their brands
DROP POLICY IF EXISTS "Users can create own brand guidelines" ON public.brand_guidelines;
CREATE POLICY "Users can create own brand guidelines"
    ON public.brand_guidelines FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = brand_guidelines.brand_id
            AND brands.user_id = auth.uid()
        )
    );

-- Users can update guidelines for their brands
DROP POLICY IF EXISTS "Users can update own brand guidelines" ON public.brand_guidelines;
CREATE POLICY "Users can update own brand guidelines"
    ON public.brand_guidelines FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = brand_guidelines.brand_id
            AND brands.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = brand_guidelines.brand_id
            AND brands.user_id = auth.uid()
        )
    );

-- Users can delete guidelines for their brands
DROP POLICY IF EXISTS "Users can delete own brand guidelines" ON public.brand_guidelines;
CREATE POLICY "Users can delete own brand guidelines"
    ON public.brand_guidelines FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.brands
            WHERE brands.id = brand_guidelines.brand_id
            AND brands.user_id = auth.uid()
        )
    );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to search for similar content using vector similarity
CREATE OR REPLACE FUNCTION public.search_similar_content(
    p_brand_id UUID,
    p_query_embedding VECTOR(1536),
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    content_type VARCHAR(50),
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        bce.id,
        bce.content,
        bce.content_type,
        1 - (bce.embedding <=> p_query_embedding) AS similarity
    FROM public.brand_content_examples bce
    WHERE bce.brand_id = p_brand_id
        AND bce.embedding IS NOT NULL
    ORDER BY bce.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search for similar brand voices
CREATE OR REPLACE FUNCTION public.search_similar_voice(
    p_query_embedding VECTOR(1536),
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    brand_id UUID,
    brand_name VARCHAR(255),
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.id AS brand_id,
        b.name AS brand_name,
        1 - (bv.voice_embedding <=> p_query_embedding) AS similarity
    FROM public.brand_voice bv
    JOIN public.brands b ON b.id = bv.brand_id
    WHERE bv.voice_embedding IS NOT NULL
        AND b.user_id = auth.uid()
    ORDER BY bv.voice_embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search for similar content across all user's brands
CREATE OR REPLACE FUNCTION public.search_global_content(
    p_user_id UUID,
    p_query_embedding VECTOR(1536),
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    content_type VARCHAR(50),
    brand_id UUID,
    brand_name VARCHAR(255),
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        bce.id,
        bce.content,
        bce.content_type,
        bce.brand_id,
        b.name AS brand_name,
        1 - (bce.embedding <=> p_query_embedding) AS similarity
    FROM public.brand_content_examples bce
    JOIN public.brands b ON b.id = bce.brand_id
    WHERE b.user_id = p_user_id
        AND bce.embedding IS NOT NULL
    ORDER BY bce.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get complete brand context
CREATE OR REPLACE FUNCTION public.get_brand_context(p_brand_id UUID)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    -- Check if user owns the brand
    IF NOT EXISTS (
        SELECT 1 FROM public.brands
        WHERE id = p_brand_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized access to brand';
    END IF;

    SELECT json_build_object(
        'brand', row_to_json(b.*),
        'voice', row_to_json(bv.*),
        'audiences', COALESCE(json_agg(DISTINCT ta.*) FILTER (WHERE ta.id IS NOT NULL), '[]'::json),
        'guidelines', row_to_json(bg.*),
        'top_content_examples', COALESCE(
            (SELECT json_agg(sub.*)
             FROM (
                SELECT id, title, content, content_type, platform
                FROM public.brand_content_examples
                WHERE brand_id = p_brand_id
                    AND is_top_performer = true
                LIMIT 5
             ) sub
            ), '[]'::json
        )
    ) INTO v_result
    FROM public.brands b
    LEFT JOIN public.brand_voice bv ON bv.brand_id = b.id
    LEFT JOIN public.target_audiences ta ON ta.brand_id = b.id
    LEFT JOIN public.brand_guidelines bg ON bg.brand_id = b.id
    WHERE b.id = p_brand_id
    GROUP BY b.id, bv.id, bg.id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to all tables
DROP TRIGGER IF EXISTS update_brands_updated_at ON public.brands;
CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON public.brands
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_brand_voice_updated_at ON public.brand_voice;
CREATE TRIGGER update_brand_voice_updated_at BEFORE UPDATE ON public.brand_voice
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_target_audiences_updated_at ON public.target_audiences;
CREATE TRIGGER update_target_audiences_updated_at BEFORE UPDATE ON public.target_audiences
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_brand_content_examples_updated_at ON public.brand_content_examples;
CREATE TRIGGER update_brand_content_examples_updated_at BEFORE UPDATE ON public.brand_content_examples
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_brand_guidelines_updated_at ON public.brand_guidelines;
CREATE TRIGGER update_brand_guidelines_updated_at BEFORE UPDATE ON public.brand_guidelines
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- MIGRATION COMPLETION
-- ============================================================================
-- Grant necessary permissions for authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Add migration success comment
COMMENT ON SCHEMA public IS 'SMGE Brand Brain system with vector search capabilities - Migration 00003 completed';
