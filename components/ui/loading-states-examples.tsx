/**
 * Loading States Usage Examples
 *
 * This file demonstrates how to use the loading and empty state components
 * in the SMGE application. These are reference examples and not meant to be
 * imported directly into your code.
 */

import { FileText, Users } from "lucide-react"
import { Button } from "./button"
import { EmptyState } from "./empty-state"
import { ErrorState } from "./error-state"
import { Spinner, PageLoading } from "./loading-spinner"
import {
  Skeleton,
  SkeletonCard,
  SkeletonListItem,
  SkeletonTableRow,
  SkeletonText,
} from "./skeleton"

// ============================================
// 1. SKELETON LOADING STATES
// ============================================

// Basic skeleton for text
function BasicSkeletonExample() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  )
}

// Card skeleton
function CardLoadingExample() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  )
}

// List skeleton
function ListLoadingExample() {
  return (
    <div className="space-y-1">
      <SkeletonListItem />
      <SkeletonListItem />
      <SkeletonListItem />
      <SkeletonListItem />
    </div>
  )
}

// Table skeleton
function TableLoadingExample() {
  return (
    <div>
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonTableRow key={i} columns={4} />
      ))}
    </div>
  )
}

// Multi-line text skeleton
function TextLoadingExample() {
  return (
    <div className="space-y-4">
      <SkeletonText lines={3} />
      <SkeletonText lines={5} />
    </div>
  )
}

// Custom skeleton pattern
function CustomSkeletonExample() {
  return (
    <div className="flex items-center gap-4">
      {/* Avatar */}
      <Skeleton className="h-16 w-16 rounded-full" />

      {/* Content */}
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      {/* Action button */}
      <Skeleton className="h-10 w-24 rounded-md" />
    </div>
  )
}

// ============================================
// 2. SPINNER LOADING STATES
// ============================================

// Different spinner sizes
function SpinnerSizesExample() {
  return (
    <div className="flex items-center gap-4">
      <Spinner size="sm" />
      <Spinner size="md" />
      <Spinner size="lg" />
      <Spinner size="xl" />
    </div>
  )
}

// Inline spinner with text
function InlineSpinnerExample() {
  return (
    <div className="flex items-center gap-2">
      <Spinner size="sm" />
      <span className="text-sm text-muted-foreground">Loading posts...</span>
    </div>
  )
}

// Button with spinner
function ButtonLoadingExample() {
  return (
    <Button disabled>
      <Spinner size="sm" className="mr-2" />
      Processing...
    </Button>
  )
}

// Full page loading
function FullPageLoadingExample() {
  return <PageLoading />
}

// Custom page loading
function CustomPageLoadingExample() {
  return (
    <PageLoading>
      <Spinner size="xl" />
      <div className="space-y-2 text-center">
        <p className="text-heading-sm font-semibold">Generating your post</p>
        <p className="text-body-sm text-muted-foreground">
          This may take a few seconds...
        </p>
      </div>
    </PageLoading>
  )
}

// ============================================
// 3. EMPTY STATES
// ============================================

// Basic empty state
function BasicEmptyStateExample() {
  return (
    <EmptyState
      icon={FileText}
      title="No posts yet"
      description="Create your first post to get started with SMGE."
    />
  )
}

// Empty state with action
function EmptyStateWithActionExample() {
  return (
    <EmptyState
      icon={FileText}
      title="No posts yet"
      description="Create your first post to get started with SMGE."
      action={<Button>Create Post</Button>}
    />
  )
}

// Multiple actions
function EmptyStateMultipleActionsExample() {
  return (
    <EmptyState
      icon={Users}
      title="No team members"
      description="Invite team members to collaborate on your social media content."
      action={
        <div className="flex gap-2">
          <Button>Invite Members</Button>
          <Button variant="outline">Learn More</Button>
        </div>
      }
    />
  )
}

// No icon variant
function EmptyStateNoIconExample() {
  return (
    <EmptyState
      title="Nothing to show here"
      description="Try adjusting your filters or search terms."
    />
  )
}

// ============================================
// 4. ERROR STATES
// ============================================

// Basic error state
function BasicErrorStateExample() {
  return <ErrorState />
}

// Error with custom message
function CustomErrorStateExample() {
  return (
    <ErrorState
      title="Failed to load posts"
      message="There was an error loading your posts. Please check your connection and try again."
    />
  )
}

// Error with retry
function ErrorWithRetryExample() {
  const handleRetry = () => {
    console.log("Retrying...")
  }

  return (
    <ErrorState
      title="Connection failed"
      message="Unable to connect to the server. Please check your internet connection."
      onRetry={handleRetry}
    />
  )
}

// ============================================
// 5. REAL-WORLD USAGE PATTERNS
// ============================================

// Data fetching pattern
function DataFetchingExample() {
  const isLoading = false
  const error: string | null = null
  const data: Array<Record<string, unknown>> = []

  if (error) {
    return (
      <ErrorState
        title="Failed to load data"
        message={error}
        onRetry={() => console.log("Retry")}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No data found"
        description="Start by creating your first item."
        action={<Button>Create New</Button>}
      />
    )
  }

  // Render actual data
  return <div>Data here</div>
}

// List view with loading states
function ListViewExample() {
  const isLoading = false
  const isEmpty = true

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonListItem key={i} />
        ))}
      </div>
    )
  }

  if (isEmpty) {
    return (
      <EmptyState
        icon={FileText}
        title="No items in this list"
        description="Add your first item to get started."
      />
    )
  }

  return <div>List items</div>
}

// Form submission pattern
function FormSubmissionExample() {
  const isSubmitting = true

  return (
    <Button disabled={isSubmitting}>
      {isSubmitting && <Spinner size="sm" className="mr-2" />}
      {isSubmitting ? "Saving..." : "Save Changes"}
    </Button>
  )
}

// Partial loading (infinite scroll)
function InfiniteScrollExample() {
  const hasMore = true
  const isLoadingMore = true

  return (
    <div className="space-y-4">
      {/* Existing items */}
      <div>Existing content...</div>

      {/* Loading indicator for more items */}
      {hasMore && isLoadingMore && (
        <div className="flex justify-center py-4">
          <Spinner size="md" />
        </div>
      )}
    </div>
  )
}

export {
  // Skeleton examples
  BasicSkeletonExample,
  CardLoadingExample,
  ListLoadingExample,
  TableLoadingExample,
  TextLoadingExample,
  CustomSkeletonExample,

  // Spinner examples
  SpinnerSizesExample,
  InlineSpinnerExample,
  ButtonLoadingExample,
  FullPageLoadingExample,
  CustomPageLoadingExample,

  // Empty state examples
  BasicEmptyStateExample,
  EmptyStateWithActionExample,
  EmptyStateMultipleActionsExample,
  EmptyStateNoIconExample,

  // Error state examples
  BasicErrorStateExample,
  CustomErrorStateExample,
  ErrorWithRetryExample,

  // Real-world patterns
  DataFetchingExample,
  ListViewExample,
  FormSubmissionExample,
  InfiniteScrollExample,
}
