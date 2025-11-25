/**
 * Social Media Scheduler Page
 *
 * Main calendar view for scheduling and managing social media posts
 */

import { Suspense } from 'react';
import { SchedulerCalendar } from '@/components/scheduler/SchedulerCalendar';
import { SchedulerHeader } from '@/components/scheduler/SchedulerHeader';
import { QueueSummary } from '@/components/scheduler/QueueSummary';

export default function SchedulerPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <SchedulerHeader />

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Calendar View */}
        <div className="lg:col-span-3">
          <Suspense fallback={<CalendarSkeleton />}>
            <SchedulerCalendar />
          </Suspense>
        </div>

        {/* Sidebar: Queue Summary */}
        <div className="lg:col-span-1">
          <Suspense fallback={<QueueSkeleton />}>
            <QueueSummary />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 dark:bg-slate-900 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

function QueueSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-slate-100 dark:bg-slate-900 rounded" />
        ))}
      </div>
    </div>
  );
}
