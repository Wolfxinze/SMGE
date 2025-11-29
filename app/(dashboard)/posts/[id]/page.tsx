'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft,
  Save,
  Trash2,
  RefreshCw,
  Calendar,
  Check,
} from 'lucide-react';

interface Post {
  id: string;
  title: string | null;
  body: string;
  content_type: string;
  status: 'draft' | 'scheduled' | 'published';
  created_at: string;
  updated_at: string;
  published_at: string | null;
  brand_id: string;
  user_id: string;
  hashtags: string[] | null;
  brand: {
    id: string;
    name: string;
  } | null;
}

export default function EditPostPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params.id as string;
  const supabase = createClient();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (postId) {
      fetchPost();
    }
  }, [postId]);

  const fetchPost = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check authentication first
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push('/auth/signin');
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('posts')
        .select(
          `
          *,
          brand:brands(id, name)
        `
        )
        .eq('id', postId)
        .single();

      if (fetchError) throw fetchError;

      if (!data) {
        setError('Post not found');
        return;
      }

      // Map database response to Post interface
      const postData: Post = {
        id: data.id,
        title: data.title,
        body: data.body,
        content_type: data.content_type,
        status: data.status as 'draft' | 'scheduled' | 'published',
        created_at: data.created_at,
        updated_at: data.updated_at,
        published_at: data.published_at,
        brand_id: data.brand_id,
        user_id: data.user_id,
        hashtags: Array.isArray(data.hashtags) ? data.hashtags as string[] : null,
        brand: data.brand,
      };
      setPost(postData);
    } catch (err) {
      console.error('Error fetching post:', err);
      setError(err instanceof Error ? err.message : 'Failed to load post');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!post) return;

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      // Get current user for ownership verification
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error('Authentication error:', authError);
        router.push('/auth/signin');
        return;
      }

      // Verify ownership before allowing update
      if (post.user_id !== user.id) {
        setError('You do not have permission to edit this post');
        setSaving(false);
        return;
      }

      // Update with ownership verification in query
      const { error: updateError } = await supabase
        .from('posts')
        .update({
          title: post.title,
          body: post.body,
          content_type: post.content_type,
          status: post.status,
          hashtags: post.hashtags,
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id)
        .eq('user_id', user.id);  // Double-check ownership in query

      if (updateError) throw updateError;

      setSuccessMessage('Post saved successfully!');

      // Refresh the post data
      await fetchPost();
    } catch (err) {
      console.error('Error saving post:', err);
      setError(err instanceof Error ? err.message : 'Failed to save post');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!post) return;

    if (
      !confirm(
        'Are you sure you want to delete this post? This action cannot be undone.'
      )
    ) {
      return;
    }

    try {
      setDeleting(true);
      setError(null);

      // Get current user for ownership verification
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error('Authentication error:', authError);
        router.push('/auth/signin');
        return;
      }

      // Verify ownership before allowing deletion
      if (post.user_id !== user.id) {
        setError('You do not have permission to delete this post');
        setDeleting(false);
        return;
      }

      // Delete with ownership verification in query
      const { error: deleteError } = await supabase
        .from('posts')
        .delete()
        .eq('id', post.id)
        .eq('user_id', user.id);  // Double-check ownership in query

      if (deleteError) throw deleteError;

      // Redirect to posts list
      router.push('/posts');
    } catch (err) {
      console.error('Error deleting post:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete post');
      setDeleting(false);
    }
  };

  const handleSchedule = () => {
    // TODO: Implement scheduling interface
    setSuccessMessage('Scheduling feature coming soon!');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'published':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error && !post) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/posts')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Posts
        </Button>
      </div>
    );
  }

  if (!post) return null;

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      {/* Back Navigation */}
      <Link
        href="/posts"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Posts
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Edit Post</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge className={getStatusColor(post.status)}>{post.status}</Badge>
            <Badge variant="outline">{post.content_type}</Badge>
            {post.brand && <Badge variant="secondary">{post.brand.name}</Badge>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={deleting || saving}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle>Post Content</CardTitle>
          <CardDescription>
            Edit your post content and settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title (Optional)</Label>
            <Input
              id="title"
              value={post.title || ''}
              onChange={(e) => setPost({ ...post, title: e.target.value })}
              placeholder="Enter a title for your post"
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label htmlFor="body">Content</Label>
            <Textarea
              id="body"
              value={post.body}
              onChange={(e) => setPost({ ...post, body: e.target.value })}
              rows={12}
              className="font-sans"
              placeholder="Write your post content here..."
            />
            <p className="text-sm text-muted-foreground">
              {post.body.length} characters
            </p>
          </div>

          {/* Content Type */}
          <div className="space-y-2">
            <Label htmlFor="content_type">Content Type</Label>
            <Select
              value={post.content_type}
              onValueChange={(value) =>
                setPost({ ...post, content_type: value })
              }
            >
              <SelectTrigger id="content_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="post">Post</SelectItem>
                <SelectItem value="story">Story</SelectItem>
                <SelectItem value="reel">Reel</SelectItem>
                <SelectItem value="carousel">Carousel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={post.status}
              onValueChange={(value: 'draft' | 'scheduled' | 'published') =>
                setPost({ ...post, status: value })
              }
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Metadata */}
          <div className="pt-4 border-t">
            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div>
                <span className="font-medium">Created:</span>{' '}
                {new Date(post.created_at).toLocaleString()}
              </div>
              <div>
                <span className="font-medium">Updated:</span>{' '}
                {new Date(post.updated_at).toLocaleString()}
              </div>
              {post.published_at && (
                <div className="col-span-2">
                  <span className="font-medium">Published:</span>{' '}
                  {new Date(post.published_at).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          {saving ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>

        {post.status === 'draft' && (
          <Button
            onClick={handleSchedule}
            variant="outline"
            disabled={saving}
            className="flex-1"
          >
            <Calendar className="mr-2 h-4 w-4" />
            Schedule Post
          </Button>
        )}
      </div>
    </div>
  );
}
