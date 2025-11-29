import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[400px] flex-col items-center justify-center gap-6 px-4 text-center",
        className
      )}
    >
      {Icon && (
        <div className="rounded-full bg-muted p-6">
          <Icon className="h-12 w-12 text-muted-foreground" strokeWidth={1.5} />
        </div>
      )}
      <div className="space-y-2">
        <h3 className="text-heading-sm font-semibold">{title}</h3>
        {description && (
          <p className="text-body-sm text-muted-foreground max-w-md">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export { EmptyState }
export type { EmptyStateProps }
