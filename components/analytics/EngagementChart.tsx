'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface EngagementChartProps {
  data: Array<{
    date: string;
    posts: number;
    reach: number;
    impressions: number;
    engagement: number;
  }>;
  title?: string;
}

export function EngagementChart({
  data,
  title = 'Engagement Over Time',
}: EngagementChartProps) {
  // Format data for display
  const chartData = data.map((item) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickMargin={10}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="reach"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              name="Reach"
            />
            <Line
              type="monotone"
              dataKey="impressions"
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              name="Impressions"
            />
            <Line
              type="monotone"
              dataKey="engagement"
              stroke="hsl(var(--chart-3))"
              strokeWidth={2}
              name="Engagement"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
