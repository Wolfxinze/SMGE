/**
 * Queue Summary Component
 *
 * Displays upcoming posts, in-progress posts, and recent failures
 */

'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface QueueStats {
  pending: number;
  processing: number;
  published_today: number;
  failed: number;
}

export function QueueSummary() {
  const [stats, setStats] = useState<QueueStats>({
    pending: 0,
    processing: 0,
    published_today: 0,
    failed: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQueueStats();

    // Refresh every 30 seconds
    const interval = setInterval(fetchQueueStats, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchQueueStats() {
    try {
      // Fetch pending posts
      const pendingResponse = await fetch('/api/scheduler/schedule?status=pending');
      const pendingData = await pendingResponse.json();

      // Fetch processing posts
      const processingResponse = await fetch('/api/scheduler/schedule?status=processing');
      const processingData = await processingResponse.json();

      // Fetch failed posts
      const failedResponse = await fetch('/api/scheduler/schedule?status=failed');
      const failedData = await failedResponse.json();

      // Fetch published posts from today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const publishedResponse = await fetch(
        `/api/scheduler/schedule?status=published&start=${today.toISOString()}`
      );
      const publishedData = await publishedResponse.json();

      setStats({
        pending: pendingData.count || 0,
        processing: processingData.count || 0,
        published_today: publishedData.count || 0,
        failed: failedData.count || 0,
      });

      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch queue stats:', error);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4 text-slate-900 dark:text-slate-50">
          Queue Status
        </h3>

        <div className="space-y-4">
          {/* Pending Posts */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Pending
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  Scheduled posts
                </div>
              </div>
            </div>
            <Badge variant="secondary" className="text-lg font-bold">
              {stats.pending}
            </Badge>
          </div>

          {/* Processing Posts */}
          {stats.processing > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 text-yellow-600 dark:text-yellow-400 animate-spin" />
                <div>
                  <div className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                    Processing
                  </div>
                  <div className="text-xs text-yellow-600 dark:text-yellow-400">
                    Being published
                  </div>
                </div>
              </div>
              <Badge variant="secondary" className="text-lg font-bold">
                {stats.processing}
              </Badge>
            </div>
          )}

          {/* Published Today */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div>
                <div className="text-sm font-medium text-green-900 dark:text-green-100">
                  Published
                </div>
                <div className="text-xs text-green-600 dark:text-green-400">
                  Today
                </div>
              </div>
            </div>
            <Badge variant="secondary" className="text-lg font-bold">
              {stats.published_today}
            </Badge>
          </div>

          {/* Failed Posts */}
          {stats.failed > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                <div>
                  <div className="text-sm font-medium text-red-900 dark:text-red-100">
                    Failed
                  </div>
                  <div className="text-xs text-red-600 dark:text-red-400">
                    Need attention
                  </div>
                </div>
              </div>
              <Badge variant="destructive" className="text-lg font-bold">
                {stats.failed}
              </Badge>
            </div>
          )}
        </div>

        {stats.failed > 0 && (
          <Button variant="outline" className="w-full mt-4" size="sm">
            View Failed Posts
          </Button>
        )}
      </Card>

      {/* Quick Stats */}
      <Card className="p-6">
        <h3 className="font-semibold text-sm mb-3 text-slate-900 dark:text-slate-50">
          Quick Actions
        </h3>
        <div className="space-y-2">
          <Button variant="outline" className="w-full justify-start" size="sm">
            View Full Queue
          </Button>
          <Button variant="outline" className="w-full justify-start" size="sm">
            Analytics Dashboard
          </Button>
          <Button variant="outline" className="w-full justify-start" size="sm">
            Connected Accounts
          </Button>
        </div>
      </Card>
    </div>
  );
}
