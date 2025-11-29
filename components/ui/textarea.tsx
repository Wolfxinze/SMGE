import * as React from "react"
import { Check, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends Omit<React.ComponentProps<"textarea">, "size"> {
  label?: string
  error?: string
  success?: boolean
  loading?: boolean
  showCount?: boolean
  maxLength?: number
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      error,
      success = false,
      loading = false,
      showCount = false,
      maxLength,
      ...props
    },
    ref
  ) => {
    const [charCount, setCharCount] = React.useState(0)
    const [shouldShake, setShouldShake] = React.useState(false)

    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)

    React.useImperativeHandle(ref, () => textareaRef.current!)

    React.useEffect(() => {
      if (textareaRef.current) {
        setCharCount(textareaRef.current.value.length)
      }
    }, [])

    React.useEffect(() => {
      if (error) {
        setShouldShake(true)
        const timer = setTimeout(() => setShouldShake(false), 500)
        return () => clearTimeout(timer)
      }
    }, [error])

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCharCount(e.target.value.length)
      props.onChange?.(e)
    }

    // Calculate character count color based on usage
    const getCountColor = () => {
      if (!maxLength) return "text-muted-foreground"
      const percentage = (charCount / maxLength) * 100
      if (percentage >= 100) return "text-destructive"
      if (percentage >= 90) return "text-warning"
      if (percentage >= 75) return "text-info"
      return "text-muted-foreground"
    }

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium mb-1.5 text-foreground">
            {label}
          </label>
        )}
        <div className="relative">
          <textarea
            className={cn(
              "flex min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground transition-all duration-200 resize-vertical",
              // Focus states
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
              // Error state
              error && "border-destructive",
              // Success state
              success && !error && "border-success",
              // Default border
              !error && !success && "border-input",
              // Disabled state
              "disabled:cursor-not-allowed disabled:opacity-50",
              // Shake animation
              shouldShake && "animate-shake",
              // Add padding for icons
              (loading || success) && "pr-10",
              "md:text-sm",
              className
            )}
            ref={textareaRef}
            disabled={loading || props.disabled}
            maxLength={maxLength}
            onChange={handleChange}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={
              error
                ? `${props.id}-error`
                : showCount
                ? `${props.id}-count`
                : undefined
            }
            {...props}
          />
          {loading && (
            <div className="absolute right-3 top-3">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {success && !loading && !error && (
            <div className="absolute right-3 top-3">
              <Check className="h-5 w-5 text-success" />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mt-1">
          <div>
            {error && (
              <p
                id={`${props.id}-error`}
                className="text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}
          </div>
          {showCount && (
            <p
              id={`${props.id}-count`}
              className={cn(
                "text-sm font-medium transition-colors duration-200",
                getCountColor()
              )}
              aria-live="polite"
            >
              {charCount}
              {maxLength && ` / ${maxLength}`}
            </p>
          )}
        </div>
      </div>
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
