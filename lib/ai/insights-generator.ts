/**
 * AI Insights Generator
 * Uses OpenAI/Claude to generate actionable insights from analytics data
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

interface ContentInsights {
  content_type_performance: Record<string, any>;
  hashtag_performance: Array<any>;
  posting_time_analysis: Array<any>;
  platform_comparison: Record<string, any>;
}

interface AIInsight {
  category: 'content' | 'timing' | 'platform' | 'hashtag' | 'general';
  title: string;
  description: string;
  recommendation: string;
  priority: 'high' | 'medium' | 'low';
  data_points?: any;
}

/**
 * Generate AI-powered insights from analytics data
 */
export async function generateInsights(
  insights: ContentInsights,
  brandName: string,
  model: 'openai' | 'claude' = 'openai'
): Promise<AIInsight[]> {
  const prompt = buildInsightsPrompt(insights, brandName);

  try {
    if (model === 'claude' && process.env.ANTHROPIC_API_KEY) {
      return await generateWithClaude(prompt);
    } else {
      return await generateWithOpenAI(prompt);
    }
  } catch (error) {
    console.error('Error generating insights:', error);
    // Return fallback basic insights
    return generateFallbackInsights(insights);
  }
}

/**
 * Build the prompt for AI insights generation
 */
function buildInsightsPrompt(
  insights: ContentInsights,
  brandName: string
): string {
  return `You are a social media analytics expert analyzing performance data for "${brandName}".

Based on the following analytics data, provide actionable insights and recommendations:

CONTENT TYPE PERFORMANCE:
${JSON.stringify(insights.content_type_performance, null, 2)}

HASHTAG PERFORMANCE:
${JSON.stringify(insights.hashtag_performance?.slice(0, 10), null, 2)}

POSTING TIME ANALYSIS:
${JSON.stringify(insights.posting_time_analysis?.slice(0, 20), null, 2)}

PLATFORM COMPARISON:
${JSON.stringify(insights.platform_comparison, null, 2)}

Generate 5-7 specific, actionable insights in the following JSON format:
{
  "insights": [
    {
      "category": "content|timing|platform|hashtag|general",
      "title": "Brief insight title",
      "description": "Detailed explanation of what the data shows",
      "recommendation": "Specific action to take",
      "priority": "high|medium|low"
    }
  ]
}

Focus on:
1. Best performing content types and why
2. Optimal posting times based on engagement patterns
3. Platform-specific strategies
4. Hashtag effectiveness
5. Growth opportunities

Provide only the JSON response, no additional text.`;
}

/**
 * Generate insights using OpenAI
 */
async function generateWithOpenAI(prompt: string): Promise<AIInsight[]> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a data-driven social media analytics expert. Provide insights in valid JSON format only.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });

  const response = completion.choices[0]?.message?.content;
  if (!response) {
    throw new Error('No response from OpenAI');
  }

  const parsed = JSON.parse(response);
  return parsed.insights || [];
}

/**
 * Generate insights using Claude
 */
async function generateWithClaude(prompt: string): Promise<AIInsight[]> {
  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2000,
    temperature: 0.7,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const parsed = JSON.parse(content.text);
  return parsed.insights || [];
}

/**
 * Generate basic fallback insights if AI fails
 */
function generateFallbackInsights(insights: ContentInsights): AIInsight[] {
  const fallbackInsights: AIInsight[] = [];

  // Content type insight
  if (insights.content_type_performance) {
    const types = Object.entries(insights.content_type_performance);
    if (types.length > 0) {
      const sorted = types.sort(
        (a, b) =>
          (b[1].avg_engagement_rate || 0) - (a[1].avg_engagement_rate || 0)
      );
      const best = sorted[0];

      fallbackInsights.push({
        category: 'content',
        title: `${best[0]} performs best`,
        description: `Your ${best[0]} content has the highest average engagement rate at ${((best[1].avg_engagement_rate || 0) * 100).toFixed(2)}%.`,
        recommendation: `Focus on creating more ${best[0]} content to maximize engagement.`,
        priority: 'high',
      });
    }
  }

  // Hashtag insight
  if (insights.hashtag_performance && insights.hashtag_performance.length > 0) {
    const topHashtag = insights.hashtag_performance[0];
    fallbackInsights.push({
      category: 'hashtag',
      title: 'Top performing hashtag',
      description: `"${topHashtag.hashtag}" shows strong performance with ${((topHashtag.avg_engagement || 0) * 100).toFixed(2)}% engagement rate.`,
      recommendation: `Continue using "${topHashtag.hashtag}" and similar hashtags in your posts.`,
      priority: 'medium',
    });
  }

  // Platform insight
  if (insights.platform_comparison) {
    const platforms = Object.entries(insights.platform_comparison);
    if (platforms.length > 0) {
      const sorted = platforms.sort(
        (a, b) =>
          (b[1].avg_engagement_rate || 0) - (a[1].avg_engagement_rate || 0)
      );
      const best = sorted[0];

      fallbackInsights.push({
        category: 'platform',
        title: `${best[0]} drives highest engagement`,
        description: `${best[0]} shows the strongest engagement rate at ${((best[1].avg_engagement_rate || 0) * 100).toFixed(2)}%.`,
        recommendation: `Prioritize ${best[0]} for your most important content.`,
        priority: 'high',
      });
    }
  }

  return fallbackInsights;
}

/**
 * Get optimal posting times from analytics data
 */
export function analyzePostingTimes(postingTimeData: Array<any>): {
  best_times: Array<{ day: number; hour: number; engagement: number }>;
  worst_times: Array<{ day: number; hour: number; engagement: number }>;
} {
  if (!postingTimeData || postingTimeData.length === 0) {
    return { best_times: [], worst_times: [] };
  }

  const sorted = [...postingTimeData].sort(
    (a, b) => (b.avg_engagement || 0) - (a.avg_engagement || 0)
  );

  const best_times = sorted.slice(0, 5).map((item) => ({
    day: item.day_of_week,
    hour: item.hour_of_day,
    engagement: item.avg_engagement,
  }));

  const worst_times = sorted
    .slice(-5)
    .reverse()
    .map((item) => ({
      day: item.day_of_week,
      hour: item.hour_of_day,
      engagement: item.avg_engagement,
    }));

  return { best_times, worst_times };
}

/**
 * Format day of week number to name
 */
export function formatDayOfWeek(day: number): string {
  const days = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  return days[day] || 'Unknown';
}

/**
 * Format hour to readable time
 */
export function formatHour(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:00 ${period}`;
}
