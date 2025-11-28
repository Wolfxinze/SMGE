'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MetricCard } from '@/components/analytics/MetricCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Eye,
  Heart,
  MessageSquare,
  Share2,
  Bookmark,
  MousePointerClick,
  TrendingUp,
  Calendar,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

interface PostAnalytics {
  post: {
    id: string;
    title: string;
    body: string;
    content_type: string;
    hashtags: string[];
    published_at: string;
    created_at: string;
  };
  platforms: Array<{
    platform: string;
    platform_url: string;
    platform_post_id: string;
    published_at: string;
    reach: number;
    impressions: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    clicks: number;
    engagement_rate: number;
    video_views: number;
    video_watch_time_seconds: number;
    audience_demographics: any;
    metrics_fetched_at: string;
  }>;
}

export default function PostAnalyticsPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params?.id as string;

  const [analytics, setAnalytics] = useState<PostAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPostAnalytics() {
      if (!postId) return;

      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/analytics/posts/${postId}`);

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error('Access denied to this post');
          }
          throw new Error('Failed to fetch post analytics');
        }

        const data = await response.json();
        setAnalytics(data.analytics);
      } catch (err: any) {
        console.error('Error fetching post analytics:', err);
        setError(err.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    }

    fetchPostAnalytics();
  }, [postId]);

  const formatNumber = (num: number) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatEngagementRate = (rate: number) => {
    if (!rate) return '0%';
    return `${(rate * 100).toFixed(2)}%`;
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0s';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="container mx-auto p-6">
        <Button variant="ghost" onClick={() => router.back()} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="text-center py-12">
          <p className="text-muted-foreground">{error || 'Post not found'}</p>
        </div>
      </div>
    );
  }

  const totalEngagement = analytics.platforms.reduce(
    (sum, p) => sum + (p.likes + p.comments + p.shares + p.saves),
    0
  );
  const totalReach = analytics.platforms.reduce((sum, p) => sum + (p.reach || 0), 0);
  const totalImpressions = analytics.platforms.reduce(
    (sum, p) => sum + (p.impressions || 0),
    0
  );
  const avgEngagementRate =
    analytics.platforms.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) /
    (analytics.platforms.length || 1);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Analytics
        </Button>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">{analytics.post.content_type}</Badge>
              <span className="text-sm text-muted-foreground">
                Published {new Date(analytics.post.published_at).toLocaleDateString()}
              </span>
            </div>
            {analytics.post.title && (
              <h1 className="text-3xl font-bold mb-2">{analytics.post.title}</h1>
            )}
            <p className="text-muted-foreground line-clamp-3 max-w-3xl">
              {analytics.post.body}
            </p>
            {analytics.post.hashtags && analytics.post.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {analytics.post.hashtags.map((tag, i) => (
                  <Badge key={i} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overall Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Reach"
          value={formatNumber(totalReach)}
          icon={Eye}
          subtitle="Across all platforms"
        />
        <MetricCard
          title="Total Impressions"
          value={formatNumber(totalImpressions)}
          icon={TrendingUp}
          subtitle="Times content was displayed"
        />
        <MetricCard
          title="Total Engagement"
          value={formatNumber(totalEngagement)}
          icon={Heart}
          subtitle="Likes, comments, shares, saves"
        />
        <MetricCard
          title="Avg Engagement Rate"
          value={formatEngagementRate(avgEngagementRate)}
          icon={TrendingUp}
          subtitle="Across all platforms"
        />
      </div>

      {/* Platform-Specific Analytics */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Platform Breakdown</h2>

        {analytics.platforms.map((platform, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="capitalize flex items-center gap-2">
                  {platform.platform}
                  {platform.platform_url && (
                    <a
                      href={platform.platform_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </CardTitle>
                <Badge variant="outline">
                  {formatEngagementRate(platform.engagement_rate)} engagement
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center gap-3">
                  <Eye className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">
                      {formatNumber(platform.reach)}
                    </p>
                    <p className="text-sm text-muted-foreground">Reach</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <TrendingUp className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">
                      {formatNumber(platform.impressions)}
                    </p>
                    <p className="text-sm text-muted-foreground">Impressions</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Heart className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">
                      {formatNumber(platform.likes)}
                    </p>
                    <p className="text-sm text-muted-foreground">Likes</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <MessageSquare className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">
                      {formatNumber(platform.comments)}
                    </p>
                    <p className="text-sm text-muted-foreground">Comments</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Share2 className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">
                      {formatNumber(platform.shares)}
                    </p>
                    <p className="text-sm text-muted-foreground">Shares</p>
                  </div>
                </div>

                {platform.saves > 0 && (
                  <div className="flex items-center gap-3">
                    <Bookmark className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">
                        {formatNumber(platform.saves)}
                      </p>
                      <p className="text-sm text-muted-foreground">Saves</p>
                    </div>
                  </div>
                )}

                {platform.clicks > 0 && (
                  <div className="flex items-center gap-3">
                    <MousePointerClick className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">
                        {formatNumber(platform.clicks)}
                      </p>
                      <p className="text-sm text-muted-foreground">Clicks</p>
                    </div>
                  </div>
                )}

                {platform.video_views > 0 && (
                  <div className="flex items-center gap-3">
                    <Eye className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">
                        {formatNumber(platform.video_views)}
                      </p>
                      <p className="text-sm text-muted-foreground">Video Views</p>
                    </div>
                  </div>
                )}

                {platform.video_watch_time_seconds > 0 && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">
                        {formatDuration(platform.video_watch_time_seconds)}
                      </p>
                      <p className="text-sm text-muted-foreground">Watch Time</p>
                    </div>
                  </div>
                )}
              </div>

              {platform.metrics_fetched_at && (
                <p className="text-xs text-muted-foreground mt-4">
                  Last updated:{' '}
                  {new Date(platform.metrics_fetched_at).toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
