/**
 * Scheduler Header Component
 *
 * Header with title, brand selector, and quick actions
 */

'use client';

import { Button } from '@/components/ui/button';
import { Calendar, Plus } from 'lucide-react';

export function SchedulerHeader() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Calendar className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
            Social Scheduler
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Schedule and manage posts across all platforms
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm">
          View Queue
        </Button>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Schedule Post
        </Button>
      </div>
    </div>
  );
}
