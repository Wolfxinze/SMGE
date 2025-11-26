/**
 * Scheduler Calendar Component
 *
 * Main calendar view displaying scheduled posts
 * Simplified implementation without external calendar library
 */

'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ScheduledPost {
  id: string;
  scheduled_for: string;
  status: string;
  posts: {
    title: string;
    body: string;
  };
  social_accounts: {
    platform: string;
    account_name: string;
  };
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-500',
  twitter: 'bg-blue-500',
  linkedin: 'bg-blue-700',
  tiktok: 'bg-black',
  facebook: 'bg-blue-600',
};

export function SchedulerCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);

  useEffect(() => {
    fetchScheduledPosts();
  }, [currentDate]);

  async function fetchScheduledPosts() {
    try {

      // Calculate date range for current month
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const response = await fetch(
        `/api/scheduler/schedule?start=${start.toISOString()}&end=${end.toISOString()}`
      );

      if (response.ok) {
        const data = await response.json();
        setScheduledPosts(data.scheduled_posts || []);
      }
    } catch (error) {
      console.error('Failed to fetch scheduled posts:', error);
    }
  }

  function getDaysInMonth(date: Date): Date[] {
    const year = date.getFullYear();
    const month = date.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: Date[] = [];

    // Add days from previous month to fill first week
    const firstDayOfWeek = firstDay.getDay();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = new Date(year, month, -i);
      days.push(day);
    }

    // Add days of current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }

    // Add days from next month to fill last week
    const remainingDays = 7 - (days.length % 7);
    if (remainingDays < 7) {
      for (let i = 1; i <= remainingDays; i++) {
        days.push(new Date(year, month + 1, i));
      }
    }

    return days;
  }

  function getPostsForDay(date: Date): ScheduledPost[] {
    return scheduledPosts.filter(post => {
      const postDate = new Date(post.scheduled_for);
      return (
        postDate.getDate() === date.getDate() &&
        postDate.getMonth() === date.getMonth() &&
        postDate.getFullYear() === date.getFullYear()
      );
    });
  }

  function previousMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  }

  function isCurrentMonth(date: Date): boolean {
    return date.getMonth() === currentDate.getMonth();
  }

  const days = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <Card className="p-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
          {monthName}
        </h2>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={previousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
          >
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Day Headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div
            key={day}
            className="text-center text-sm font-semibold text-slate-600 dark:text-slate-400 py-2"
          >
            {day}
          </div>
        ))}

        {/* Calendar Days */}
        {days.map((date, index) => {
          const postsForDay = getPostsForDay(date);
          const isToday =
            date.toDateString() === new Date().toDateString();
          const isOtherMonth = !isCurrentMonth(date);

          return (
            <div
              key={index}
              className={`
                min-h-[120px] border rounded-lg p-2
                ${isOtherMonth ? 'bg-slate-50 dark:bg-slate-900' : 'bg-white dark:bg-slate-950'}
                ${isToday ? 'border-primary border-2' : 'border-slate-200 dark:border-slate-800'}
                hover:border-primary/50 transition-colors
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`
                    text-sm font-medium
                    ${isOtherMonth ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300'}
                    ${isToday ? 'text-primary font-bold' : ''}
                  `}
                >
                  {date.getDate()}
                </span>

                {postsForDay.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {postsForDay.length}
                  </Badge>
                )}
              </div>

              {/* Scheduled Posts */}
              <div className="space-y-1">
                {postsForDay.slice(0, 3).map(post => (
                  <div
                    key={post.id}
                    className={`
                      text-xs p-1.5 rounded truncate
                      ${PLATFORM_COLORS[post.social_accounts.platform] || 'bg-slate-500'}
                      text-white
                    `}
                    title={post.posts.title || post.posts.body}
                  >
                    {post.posts.title || post.posts.body.substring(0, 20)}
                  </div>
                ))}

                {postsForDay.length > 3 && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 pl-1.5">
                    +{postsForDay.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
