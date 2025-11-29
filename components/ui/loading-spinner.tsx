import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

interface SpinnerProps {
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}

const sizeMap = {
  sm: "h-4 w-4",    // 16px
  md: "h-6 w-6",    // 24px
  lg: "h-8 w-8",    // 32px
  xl: "h-12 w-12",  // 48px
}

function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <Loader2
      className={cn("animate-spin text-muted-foreground", sizeMap[size], className)}
    />
  )
}

interface PageLoadingProps {
  className?: string
  children?: React.ReactNode
}

function PageLoading({ className, children }: PageLoadingProps) {
  return (
    <div
      className={cn(
        "flex min-h-[400px] flex-col items-center justify-center gap-4",
        className
      )}
    >
      {children || (
        <>
          <Spinner size="lg" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </>
      )}
    </div>
  )
}

export { Spinner, PageLoading }
