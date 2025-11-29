import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const cardVariants = cva(
  "rounded-lg text-card-foreground",
  {
    variants: {
      variant: {
        default: "border bg-card shadow-sm",
        elevated: "border bg-card shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200",
        bordered: "border border-border hover:border-primary/50 bg-card transition-colors duration-200",
        glass: "bg-background/60 backdrop-blur-md border border-white/10",
        action: "border bg-card shadow-sm cursor-pointer hover:bg-accent/5 active:scale-[0.98] transition-all duration-200",
      },
      padding: {
        none: "",
        sm: "p-3",
        md: "p-4",
        lg: "p-6",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "none",
    },
  }
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding }), className)}
      {...props}
    />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

// CardMetric - Dashboard KPI card component
export interface CardMetricProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  value: string | number
  change?: number
  trend?: "up" | "down" | "neutral"
  icon?: React.ReactNode
  variant?: CardProps["variant"]
}

const CardMetric = React.forwardRef<HTMLDivElement, CardMetricProps>(
  ({ title, value, change, trend, icon, className, variant = "elevated", ...props }, ref) => {
    const getTrendIcon = () => {
      if (!trend || trend === "neutral") return <MinusIcon className="h-4 w-4" />
      if (trend === "up") return <ArrowUpIcon className="h-4 w-4" />
      return <ArrowDownIcon className="h-4 w-4" />
    }

    const getTrendColor = () => {
      if (!trend || trend === "neutral") return "text-muted-foreground"
      if (trend === "up") return "text-green-600 dark:text-green-400"
      return "text-red-600 dark:text-red-400"
    }

    const formatChange = (value: number) => {
      const abs = Math.abs(value)
      const sign = value >= 0 ? "+" : "-"
      return `${sign}${abs}%`
    }

    return (
      <Card ref={ref} variant={variant} className={cn("", className)} {...props}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <div className="mt-2 flex items-baseline gap-2">
                <h3 className="text-3xl font-bold tracking-tight">{value}</h3>
                {change !== undefined && (
                  <div className={cn("flex items-center gap-1 text-sm font-medium", getTrendColor())}>
                    {getTrendIcon()}
                    <span>{formatChange(change)}</span>
                  </div>
                )}
              </div>
            </div>
            {icon && (
              <div className="rounded-lg bg-primary/10 p-3 text-primary">
                {icon}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }
)
CardMetric.displayName = "CardMetric"

// Convenient variant exports
export const CardElevated = React.forwardRef<HTMLDivElement, Omit<CardProps, "variant">>(
  (props, ref) => <Card ref={ref} variant="elevated" {...props} />
)
CardElevated.displayName = "CardElevated"

export const CardBordered = React.forwardRef<HTMLDivElement, Omit<CardProps, "variant">>(
  (props, ref) => <Card ref={ref} variant="bordered" {...props} />
)
CardBordered.displayName = "CardBordered"

export const CardGlass = React.forwardRef<HTMLDivElement, Omit<CardProps, "variant">>(
  (props, ref) => <Card ref={ref} variant="glass" {...props} />
)
CardGlass.displayName = "CardGlass"

export const CardAction = React.forwardRef<HTMLDivElement, Omit<CardProps, "variant">>(
  (props, ref) => <Card ref={ref} variant="action" {...props} />
)
CardAction.displayName = "CardAction"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, CardMetric }
