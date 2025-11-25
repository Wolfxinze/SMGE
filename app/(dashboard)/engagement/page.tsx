/**
 * Engagement Agent Dashboard
 * Main page for managing comment/DM responses
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface QueueItem {
  engagement_id: string;
  response_id: string;
  author_username: string;
  content: string;
  response_text: string;
  sentiment: string;
  priority: string;
  created_at: string;
}

interface Analytics {
  total_engagement_items: number;
  pending_responses: number;
  approved_responses: number;
  posted_responses: number;
  avg_response_time_minutes: number | null;
  sentiment_distribution: Record<string, number>;
  platform_distribution: Record<string, number>;
}

export default function EngagementPage() {
  const router = useRouter();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState<string>('');

  useEffect(() => {
    // Get brand ID from localStorage or fetch user's brands
    const brandId = localStorage.getItem('selected_brand_id');
    if (brandId) {
      setSelectedBrandId(brandId);
      loadData(brandId);
    } else {
      setError('No brand selected. Please select a brand first.');
      setLoading(false);
    }
  }, []);

  async function loadData(brandId: string) {
    try {
      setLoading(true);
      setError(null);

      // Fetch approval queue
      const queueRes = await fetch(`/api/engagement/queue?brand_id=${brandId}`);
      if (!queueRes.ok) throw new Error('Failed to fetch approval queue');
      const queueData = await queueRes.json();
      setQueue(queueData.queue || []);

      // Fetch analytics
      const analyticsRes = await fetch(`/api/engagement/analytics?brand_id=${brandId}&days=30`);
      if (!analyticsRes.ok) throw new Error('Failed to fetch analytics');
      const analyticsData = await analyticsRes.json();
      setAnalytics(analyticsData.analytics);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(responseId: string, edited?: string) {
    try {
      const res = await fetch('/api/engagement/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response_id: responseId,
          edited_text: edited || undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to approve response');

      // Refresh queue
      await loadData(selectedBrandId);
      setEditingId(null);
      setEditedText('');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  }

  async function handleReject(responseId: string) {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      const res = await fetch('/api/engagement/approve', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response_id: responseId,
          reason,
        }),
      });

      if (!res.ok) throw new Error('Failed to reject response');

      // Refresh queue
      await loadData(selectedBrandId);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  }

  function getPriorityColor(priority: string): string {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'normal':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'low':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  }

  function getSentimentEmoji(sentiment: string): string {
    switch (sentiment) {
      case 'positive':
        return '😊';
      case 'negative':
        return '😟';
      case 'urgent':
        return '🚨';
      default:
        return '😐';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading engagement data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Engagement Agent</h1>

      {/* Analytics Overview */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-600">Total Engagement</div>
            <div className="text-3xl font-bold">{analytics.total_engagement_items}</div>
          </div>
          <div className="bg-yellow-50 p-6 rounded-lg shadow">
            <div className="text-sm text-gray-600">Pending Approval</div>
            <div className="text-3xl font-bold text-yellow-600">{analytics.pending_responses}</div>
          </div>
          <div className="bg-green-50 p-6 rounded-lg shadow">
            <div className="text-sm text-gray-600">Posted Responses</div>
            <div className="text-3xl font-bold text-green-600">{analytics.posted_responses}</div>
          </div>
          <div className="bg-blue-50 p-6 rounded-lg shadow">
            <div className="text-sm text-gray-600">Avg Response Time</div>
            <div className="text-3xl font-bold text-blue-600">
              {analytics.avg_response_time_minutes
                ? `${Math.round(analytics.avg_response_time_minutes)}m`
                : 'N/A'}
            </div>
          </div>
        </div>
      )}

      {/* Approval Queue */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-semibold">Approval Queue</h2>
          <p className="text-gray-600 mt-1">Review and approve AI-generated responses</p>
        </div>

        {queue.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <div className="text-5xl mb-4">🎉</div>
            <div className="text-lg">All caught up!</div>
            <div className="text-sm mt-2">No pending responses to review.</div>
          </div>
        ) : (
          <div className="divide-y">
            {queue.map((item) => (
              <div
                key={item.response_id}
                className={`p-6 border-l-4 ${getPriorityColor(item.priority)}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{getSentimentEmoji(item.sentiment)}</span>
                      <span className="font-semibold">{item.author_username}</span>
                      <span className="text-xs px-2 py-1 rounded bg-gray-200 uppercase">
                        {item.priority}
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-gray-200">
                        {item.sentiment}
                      </span>
                    </div>
                    <div className="text-gray-700 mb-4 pl-8">
                      <div className="font-medium mb-1">Original Comment:</div>
                      <div className="italic">"{item.content}"</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(item.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg mb-4">
                  <div className="font-medium mb-2">AI-Generated Response:</div>
                  {editingId === item.response_id ? (
                    <textarea
                      className="w-full p-2 border rounded"
                      rows={3}
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                    />
                  ) : (
                    <div className="text-gray-800">{item.response_text}</div>
                  )}
                </div>

                <div className="flex gap-3">
                  {editingId === item.response_id ? (
                    <>
                      <button
                        onClick={() => handleApprove(item.response_id, editedText)}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Save & Approve
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditedText('');
                        }}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleApprove(item.response_id)}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(item.response_id);
                          setEditedText(item.response_text);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleReject(item.response_id)}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
