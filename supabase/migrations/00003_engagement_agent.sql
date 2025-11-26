-- Create engagement_items table for storing social media content to engage with
CREATE TABLE public.engagement_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'instagram', 'linkedin', 'tiktok')),
  external_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'comment', 'mention', 'dm')),
  author_username TEXT NOT NULL,
  author_display_name TEXT,
  author_follower_count INTEGER DEFAULT 0,
  is_influencer BOOLEAN DEFAULT false,
  content TEXT NOT NULL,
  media_urls TEXT[] DEFAULT '{}',
  engagement_metrics JSONB DEFAULT '{}',
  sentiment_score FLOAT CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'responded', 'ignored', 'error')),
  processing_error TEXT,
  responded_at TIMESTAMPTZ,
  response_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint to prevent duplicates
CREATE UNIQUE INDEX engagement_items_platform_external_id_key
ON engagement_items(platform, external_id);

-- Create engagement_responses table
CREATE TABLE public.engagement_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  engagement_item_id UUID REFERENCES public.engagement_items(id) ON DELETE CASCADE NOT NULL,
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
  voice_similarity FLOAT CHECK (voice_similarity >= 0 AND voice_similarity <= 1),
  suggested_edits TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'sent', 'failed')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create engagement_rules table
CREATE TABLE public.engagement_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'instagram', 'linkedin', 'tiktok', 'all')),
  rule_type TEXT NOT NULL CHECK (rule_type IN ('keyword', 'mention', 'hashtag', 'user')),
  trigger_value TEXT NOT NULL,
  response_template TEXT,
  auto_respond BOOLEAN DEFAULT false,
  min_follower_count INTEGER DEFAULT 0,
  max_responses_per_hour INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create engagement_analytics table
CREATE TABLE public.engagement_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'instagram', 'linkedin', 'tiktok', 'all')),
  total_engagements INTEGER DEFAULT 0,
  total_responses INTEGER DEFAULT 0,
  auto_approved INTEGER DEFAULT 0,
  manually_approved INTEGER DEFAULT 0,
  rejected INTEGER DEFAULT 0,
  avg_response_time INTERVAL,
  avg_confidence_score FLOAT,
  avg_sentiment_score FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX engagement_items_brand_id_status_idx ON engagement_items(brand_id, status);
CREATE INDEX engagement_items_created_at_idx ON engagement_items(created_at DESC);
CREATE INDEX engagement_responses_engagement_item_id_idx ON engagement_responses(engagement_item_id);
CREATE INDEX engagement_rules_brand_id_platform_idx ON engagement_rules(brand_id, platform);
CREATE INDEX engagement_analytics_brand_id_date_idx ON engagement_analytics(brand_id, date DESC);

-- Enable Row Level Security
ALTER TABLE engagement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_analytics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their brand's engagement items" ON engagement_items
  FOR SELECT USING (
    brand_id IN (
      SELECT id FROM brands WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their brand's engagement items" ON engagement_items
  FOR INSERT WITH CHECK (
    brand_id IN (
      SELECT id FROM brands WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their brand's engagement items" ON engagement_items
  FOR UPDATE USING (
    brand_id IN (
      SELECT id FROM brands WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their brand's engagement responses" ON engagement_responses
  FOR SELECT USING (
    brand_id IN (
      SELECT id FROM brands WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their brand's engagement responses" ON engagement_responses
  FOR ALL USING (
    brand_id IN (
      SELECT id FROM brands WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their brand's engagement rules" ON engagement_rules
  FOR ALL USING (
    brand_id IN (
      SELECT id FROM brands WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their brand's engagement analytics" ON engagement_analytics
  FOR SELECT USING (
    brand_id IN (
      SELECT id FROM brands WHERE user_id = auth.uid()
    )
  );

-- Function to clean up old engagements
CREATE OR REPLACE FUNCTION cleanup_old_engagements()
RETURNS void AS $$
BEGIN
  DELETE FROM engagement_items
  WHERE created_at < NOW() - INTERVAL '30 days'
  AND status IN ('responded', 'ignored');
END;
$$ LANGUAGE plpgsql;

-- Function to calculate engagement metrics
CREATE OR REPLACE FUNCTION calculate_engagement_metrics(p_brand_id UUID, p_date DATE)
RETURNS void AS $$
DECLARE
  v_metrics RECORD;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE ei.created_at::DATE = p_date) as total_engagements,
    COUNT(*) FILTER (WHERE er.status = 'sent' AND er.created_at::DATE = p_date) as total_responses,
    COUNT(*) FILTER (WHERE er.status = 'approved' AND er.confidence_score >= 0.8 AND er.created_at::DATE = p_date) as auto_approved,
    COUNT(*) FILTER (WHERE er.status = 'approved' AND er.confidence_score < 0.8 AND er.created_at::DATE = p_date) as manually_approved,
    COUNT(*) FILTER (WHERE er.status = 'rejected' AND er.created_at::DATE = p_date) as rejected,
    AVG(er.sent_at - ei.created_at) FILTER (WHERE er.sent_at IS NOT NULL) as avg_response_time,
    AVG(er.confidence_score) FILTER (WHERE er.status = 'sent') as avg_confidence,
    AVG(ei.sentiment_score) as avg_sentiment
  INTO v_metrics
  FROM engagement_items ei
  LEFT JOIN engagement_responses er ON ei.id = er.engagement_item_id
  WHERE ei.brand_id = p_brand_id;

  INSERT INTO engagement_analytics (
    brand_id, date, platform, total_engagements, total_responses,
    auto_approved, manually_approved, rejected, avg_response_time,
    avg_confidence_score, avg_sentiment_score
  ) VALUES (
    p_brand_id, p_date, 'all', v_metrics.total_engagements, v_metrics.total_responses,
    v_metrics.auto_approved, v_metrics.manually_approved, v_metrics.rejected,
    v_metrics.avg_response_time, v_metrics.avg_confidence, v_metrics.avg_sentiment
  )
  ON CONFLICT (brand_id, date, platform) DO UPDATE SET
    total_engagements = EXCLUDED.total_engagements,
    total_responses = EXCLUDED.total_responses,
    auto_approved = EXCLUDED.auto_approved,
    manually_approved = EXCLUDED.manually_approved,
    rejected = EXCLUDED.rejected,
    avg_response_time = EXCLUDED.avg_response_time,
    avg_confidence_score = EXCLUDED.avg_confidence_score,
    avg_sentiment_score = EXCLUDED.avg_sentiment_score;
END;
$$ LANGUAGE plpgsql;