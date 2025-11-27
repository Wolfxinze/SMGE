'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MetricCard } from '@/components/analytics/MetricCard';
import { EngagementChart } from '@/components/analytics/EngagementChart';
import { PlatformComparisonChart } from '@/components/analytics/PlatformComparisonChart';
import { TopPostsTable } from '@/components/analytics/TopPostsTable';
import { InsightsPanel } from '@/components/analytics/InsightsPanel';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  Users,
  Eye,
  Heart,
  Calendar,
  RefreshCw,
} from 'lucide-react';

interface Brand {
  id: string;
  name: string;
}

interface Analytics {
  total_posts: number;
  total_reach: number;
  total_impressions: number;
  total_engagement: number;
  avg_engagement_rate: number;
  platform_metrics: Record<string, any>;
  daily_metrics: Array<any>;
  top_posts: Array<any>;
  follower_growth: Record<string, number>;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState('30');

  // Fetch user's brands
  useEffect(() => {
    async function fetchBrands() {
      try {
        const response = await fetch('/api/brands');
        if (response.ok) {
          const data = await response.json();
          setBrands(data.brands || []);
          if (data.brands && data.brands.length > 0) {
            setSelectedBrandId(data.brands[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching brands:', error);
      }
    }

    fetchBrands();
  }, []);

  // Fetch analytics data
  useEffect(() => {
    async function fetchAnalytics() {
      if (!selectedBrandId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(dateRange));

        const params = new URLSearchParams({
          brand_id: selectedBrandId,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        });

        const response = await fetch(`/api/analytics/dashboard?${params}`);

        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }

        const data = await response.json();
        setAnalytics(data.analytics);
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    }

    fetchAnalytics();
  }, [selectedBrandId, dateRange]);

  const handleRefresh = () => {
    setRefreshing(true);
    // Trigger re-fetch by updating a dependency
    setDateRange(dateRange);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatEngagementRate = (rate: number) => {
    return `${(rate * 100).toFixed(2)}%`;
  };

  if (loading && !analytics) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!selectedBrandId || brands.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <p className="text-muted-foreground">
            No brands found. Create a brand to view analytics.
          </p>
          <Button onClick={() => router.push('/brands/new')}>
            Create Brand
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Track your social media performance across platforms
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Brand Selector */}
          <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select brand" />
            </SelectTrigger>
            <SelectContent>
              {brands.map((brand) => (
                <SelectItem key={brand.id} value={brand.id}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Range Selector */}
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
            />
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      {analytics && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Total Posts"
              value={analytics.total_posts}
              icon={Calendar}
              subtitle={`Published in last ${dateRange} days`}
            />
            <MetricCard
              title="Total Reach"
              value={formatNumber(analytics.total_reach)}
              icon={Users}
              subtitle="People reached"
            />
            <MetricCard
              title="Total Impressions"
              value={formatNumber(analytics.total_impressions)}
              icon={Eye}
              subtitle="Times content was displayed"
            />
            <MetricCard
              title="Engagement Rate"
              value={formatEngagementRate(analytics.avg_engagement_rate)}
              icon={TrendingUp}
              subtitle="Average across all posts"
            />
          </div>

          {/* Charts */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Engagement Over Time */}
            {analytics.daily_metrics && analytics.daily_metrics.length > 0 && (
              <div className="md:col-span-2">
                <EngagementChart data={analytics.daily_metrics} />
              </div>
            )}

            {/* Platform Comparison */}
            {analytics.platform_metrics &&
              Object.keys(analytics.platform_metrics).length > 0 && (
                <div className="md:col-span-2">
                  <PlatformComparisonChart data={analytics.platform_metrics} />
                </div>
              )}
          </div>

          {/* AI Insights */}
          <InsightsPanel brandId={selectedBrandId} days={parseInt(dateRange)} />

          {/* Top Posts */}
          {analytics.top_posts && analytics.top_posts.length > 0 && (
            <TopPostsTable posts={analytics.top_posts} />
          )}

          {/* Empty State */}
          {(!analytics.top_posts || analytics.top_posts.length === 0) &&
            (!analytics.daily_metrics || analytics.daily_metrics.length === 0) && (
              <div className="text-center py-12">
                <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No analytics data yet
                </h3>
                <p className="text-muted-foreground mb-6">
                  Publish some posts to start seeing analytics and insights!
                </p>
                <Button onClick={() => router.push('/posts/new')}>
                  Create Post
                </Button>
              </div>
            )}
        </>
      )}
    </div>
  );
}
