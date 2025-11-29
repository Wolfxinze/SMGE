import { AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./button"

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
}

function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load your data. Please try again.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[400px] flex-col items-center justify-center gap-6 px-4 text-center",
        className
      )}
    >
      <div className="rounded-full bg-destructive/10 p-6">
        <AlertCircle className="h-12 w-12 text-destructive" strokeWidth={1.5} />
      </div>
      <div className="space-y-2">
        <h3 className="text-heading-sm font-semibold">{title}</h3>
        {message && (
          <p className="text-body-sm text-muted-foreground max-w-md">
            {message}
          </p>
        )}
      </div>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="mt-2">
          Try again
        </Button>
      )}
    </div>
  )
}

export { ErrorState }
export type { ErrorStateProps }
