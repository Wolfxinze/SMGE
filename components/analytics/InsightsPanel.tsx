'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Lightbulb,
  TrendingUp,
  Clock,
  Hash,
  MessageSquare,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

interface AIInsight {
  category: 'content' | 'timing' | 'platform' | 'hashtag' | 'general';
  title: string;
  description: string;
  recommendation: string;
  priority: 'high' | 'medium' | 'low';
}

interface InsightsPanelProps {
  brandId: string;
  days?: number;
}

const categoryIcons = {
  content: MessageSquare,
  timing: Clock,
  platform: TrendingUp,
  hashtag: Hash,
  general: Lightbulb,
};

const priorityColors = {
  high: 'destructive',
  medium: 'default',
  low: 'secondary',
} as const;

export function InsightsPanel({ brandId, days = 30 }: InsightsPanelProps) {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInsights = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/analytics/ai-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          brand_id: brandId,
          days,
          model: 'openai',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate insights');
      }

      const data = await response.json();
      setInsights(data.insights || []);

      if (data.message) {
        setError(data.message);
      }
    } catch (err: any) {
      console.error('Error generating insights:', err);
      setError(err.message || 'Failed to generate insights');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI-Powered Insights
          </CardTitle>
          <Button
            onClick={generateInsights}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Insights
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && !insights.length && (
          <div className="text-center text-muted-foreground py-8">
            <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{error}</p>
          </div>
        )}

        {!insights.length && !error && !loading && (
          <div className="text-center text-muted-foreground py-8">
            <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>
              Click &quot;Generate Insights&quot; to get AI-powered recommendations
            </p>
          </div>
        )}

        {insights.length > 0 && (
          <div className="space-y-4">
            {insights.map((insight, index) => {
              const Icon = categoryIcons[insight.category];
              return (
                <div
                  key={index}
                  className="border rounded-lg p-4 space-y-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <h4 className="font-semibold">{insight.title}</h4>
                    </div>
                    <Badge variant={priorityColors[insight.priority]}>
                      {insight.priority}
                    </Badge>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {insight.description}
                  </p>

                  <div className="bg-primary/5 rounded-md p-3 border-l-2 border-primary">
                    <p className="text-sm font-medium">Recommendation:</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {insight.recommendation}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
