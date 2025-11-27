'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TopPost {
  id: string;
  title: string;
  body: string;
  published_at: string;
  platform: string;
  platform_url: string;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagement_rate: number;
}

interface TopPostsTableProps {
  posts: TopPost[];
  title?: string;
}

export function TopPostsTable({
  posts,
  title = 'Top Performing Posts',
}: TopPostsTableProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatEngagementRate = (rate: number) => {
    return `${(rate * 100).toFixed(2)}%`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {posts && posts.length > 0 ? (
            posts.map((post, index) => (
              <div
                key={post.id}
                className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg font-semibold text-muted-foreground">
                        #{index + 1}
                      </span>
                      <Badge variant="outline">{post.platform}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(post.published_at).toLocaleDateString()}
                      </span>
                    </div>
                    {post.title && (
                      <h4 className="font-semibold mb-1">{post.title}</h4>
                    )}
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {post.body}
                    </p>
                    <div className="flex flex-wrap gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground">Reach: </span>
                        <span className="font-medium">
                          {formatNumber(post.reach)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Likes: </span>
                        <span className="font-medium">
                          {formatNumber(post.likes)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Comments: </span>
                        <span className="font-medium">
                          {formatNumber(post.comments)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Shares: </span>
                        <span className="font-medium">
                          {formatNumber(post.shares)}
                        </span>
                      </div>
                      {post.saves > 0 && (
                        <div>
                          <span className="text-muted-foreground">Saves: </span>
                          <span className="font-medium">
                            {formatNumber(post.saves)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-2xl font-bold text-primary">
                      {formatEngagementRate(post.engagement_rate)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Engagement Rate
                    </div>
                  </div>
                </div>
                {post.platform_url && (
                  <a
                    href={post.platform_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline mt-2 inline-block"
                  >
                    View on {post.platform}
                  </a>
                )}
              </div>
            ))
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No post data available yet. Publish some posts to see analytics!
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
