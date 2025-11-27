'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PlatformMetrics {
  posts: number;
  reach: number;
  impressions: number;
  engagement: number;
  avg_engagement_rate: number;
}

interface PlatformComparisonChartProps {
  data: Record<string, PlatformMetrics>;
  title?: string;
}

export function PlatformComparisonChart({
  data,
  title = 'Platform Comparison',
}: PlatformComparisonChartProps) {
  // Transform data for the chart
  const chartData = Object.entries(data || {}).map(([platform, metrics]) => ({
    platform: platform.charAt(0).toUpperCase() + platform.slice(1),
    Posts: metrics.posts,
    Reach: metrics.reach,
    Impressions: metrics.impressions,
    Engagement: metrics.engagement,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="platform" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
            />
            <Legend />
            <Bar dataKey="Reach" fill="hsl(var(--primary))" />
            <Bar dataKey="Impressions" fill="hsl(var(--chart-2))" />
            <Bar dataKey="Engagement" fill="hsl(var(--chart-3))" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
