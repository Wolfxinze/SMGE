/**
 * Dashboard Page
 * Main authenticated landing page after login
 *
 * SECURITY: Uses client-side authentication check to prevent CDN caching issues
 * Server-side redirects with redirect() can be cached by CDN, causing authentication loops
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'

interface Brand {
  id: string
  name: string
}

interface Post {
  id: string
  body: string
  content_type: string
  created_at: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [brands, setBrands] = useState<Brand[]>([])
  const [hasPosts, setHasPosts] = useState(false)
  const [draftPosts, setDraftPosts] = useState<Post[]>([])

  useEffect(() => {
    async function loadDashboard() {
      try {
        const supabase = createClient()

        // Check authentication
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

        if (authError || !authUser) {
          // Client-side redirect - not cached by CDN
          router.push('/auth/signin')
          return
        }

        setUser(authUser)

        // Fetch user's brands to check completion status
        const { data: brandsData } = await supabase
          .from('brands')
          .select('id, name')
          .eq('user_id', authUser.id)

        if (brandsData) {
          setBrands(brandsData)
        }

        // Fetch user's posts to check completion status
        const { data: postsData } = await supabase
          .from('posts')
          .select('id')
          .eq('user_id', authUser.id)
          .limit(1)

        setHasPosts(postsData ? postsData.length > 0 : false)

        // Fetch user's draft posts
        const { data: draftsData } = await supabase
          .from('posts')
          .select('id, body, content_type, created_at')
          .eq('user_id', authUser.id)
          .eq('status', 'draft')
          .order('created_at', { ascending: false })
          .limit(5)

        if (draftsData) {
          setDraftPosts(draftsData)
        }

        setLoading(false)
      } catch (error) {
        console.error('Dashboard loading error:', error)
        // Redirect to signin on any error
        router.push('/auth/signin')
      }
    }

    loadDashboard()
  }, [router])

  // Loading state with simple spinner
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // User should always be defined here due to the redirect logic above
  if (!user) {
    return null
  }

  const hasBrands = brands.length > 0

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold">
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              SMGE
            </span>
          </Link>

          <nav className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-900 dark:text-slate-50"
            >
              Dashboard
            </Link>
            <Link
              href="/analytics"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-50"
            >
              Analytics
            </Link>
            <Link
              href="/settings"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-50"
            >
              Settings
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {user.email}
            </span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-50 dark:hover:bg-slate-700"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 bg-slate-50 dark:bg-slate-900">
        <div className="container mx-auto px-4 py-8">
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-bold text-slate-900 dark:text-slate-50">
              Welcome to SMGE
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Manage your social media presence from one powerful platform
            </p>
          </div>

          {/* Quick Stats */}
          <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                Total Posts
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-50">
                0
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                Scheduled
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-50">
                0
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                Total Reach
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-50">
                0
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                Engagement Rate
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-50">
                0%
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-semibold text-slate-900 dark:text-slate-50">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Link
                href="/posts/new"
                className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-6 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-700 dark:hover:bg-slate-900"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                  <span className="text-xl">✍️</span>
                </div>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-50">
                    Create Post
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Draft a new social post
                  </div>
                </div>
              </Link>

              <Link
                href="/analytics"
                className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-6 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-700 dark:hover:bg-slate-900"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                  <span className="text-xl">📊</span>
                </div>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-50">
                    View Analytics
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Track your performance
                  </div>
                </div>
              </Link>

              <Link
                href="/brands/new"
                className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-6 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-700 dark:hover:bg-slate-900"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                  <span className="text-xl">🎨</span>
                </div>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-50">
                    Add Brand
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Create a new brand profile
                  </div>
                </div>
              </Link>
            </div>
          </div>

          {/* Getting Started */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
            <h2 className="mb-4 text-xl font-semibold text-slate-900 dark:text-slate-50">
              Getting Started
            </h2>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 text-green-600 dark:text-green-400">
                  ✓
                </span>
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-50">
                    Account created
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Your account is ready to use
                  </div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className={`mt-0.5 ${hasBrands ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                  {hasBrands ? '✓' : '○'}
                </span>
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-50">
                    Create your first brand
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Set up brand voice and style guidelines
                  </div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 text-slate-400">○</span>
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-50">
                    Connect social accounts
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Link Instagram, Twitter, LinkedIn, or TikTok
                  </div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className={`mt-0.5 ${hasPosts ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                  {hasPosts ? '✓' : '○'}
                </span>
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-50">
                    Create your first post
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Use AI to generate engaging content
                  </div>
                </div>
              </li>
            </ul>
          </div>

          {/* Recent Drafts */}
          {draftPosts && draftPosts.length > 0 && (
            <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
                  Recent Drafts
                </h2>
                <Link
                  href="/posts"
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  View all
                </Link>
              </div>
              <div className="space-y-3">
                {draftPosts.map((draft) => (
                  <div
                    key={draft.id}
                    className="flex items-start gap-3 rounded-md border border-slate-200 p-3 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                  >
                    <div className="flex-1">
                      <p className="line-clamp-2 text-sm text-slate-900 dark:text-slate-50">
                        {draft.body}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {new Date(draft.created_at).toLocaleDateString()} · {draft.content_type}
                      </p>
                    </div>
                    <Link
                      href={`/posts/${draft.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Edit
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}