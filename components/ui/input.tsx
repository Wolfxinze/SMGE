import * as React from "react"
import { Check, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends Omit<React.ComponentProps<"input">, "size"> {
  label?: string
  floatingLabel?: boolean
  error?: string
  success?: boolean
  loading?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      label,
      floatingLabel = false,
      error,
      success = false,
      loading = false,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = React.useState(false)
    const [hasValue, setHasValue] = React.useState(false)
    const [shouldShake, setShouldShake] = React.useState(false)

    const inputRef = React.useRef<HTMLInputElement | null>(null)

    React.useImperativeHandle(ref, () => inputRef.current!)

    React.useEffect(() => {
      if (inputRef.current) {
        setHasValue(!!inputRef.current.value)
      }
    }, [])

    React.useEffect(() => {
      if (error) {
        setShouldShake(true)
        const timer = setTimeout(() => setShouldShake(false), 500)
        return () => clearTimeout(timer)
      }
    }, [error])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(!!e.target.value)
      props.onChange?.(e)
    }

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true)
      props.onFocus?.(e)
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false)
      props.onBlur?.(e)
    }

    const isFloating = floatingLabel && (isFocused || hasValue)

    if (floatingLabel && label) {
      return (
        <div className="relative">
          <input
            type={type}
            className={cn(
              "flex h-12 w-full rounded-md border bg-background px-3 pt-5 pb-1 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-transparent transition-all duration-200",
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
              className
            )}
            ref={inputRef}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            disabled={loading || props.disabled}
            placeholder=" "
            aria-invalid={error ? "true" : "false"}
            aria-describedby={error ? `${props.id}-error` : undefined}
            {...props}
          />
          <label
            className={cn(
              "absolute left-3 text-muted-foreground transition-all duration-200 pointer-events-none",
              isFloating
                ? "top-1 text-xs scale-85 text-accent"
                : "top-3 text-base"
            )}
          >
            {label}
          </label>
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
          {error && (
            <p
              id={`${props.id}-error`}
              className="mt-1 text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
      )
    }

    // Non-floating label version
    return (
      <div className="w-full">
        {label && !floatingLabel && (
          <label className="block text-sm font-medium mb-1.5 text-foreground">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            type={type}
            className={cn(
              "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground transition-all duration-200",
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
            ref={inputRef}
            disabled={loading || props.disabled}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={error ? `${props.id}-error` : undefined}
            {...props}
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {success && !loading && !error && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Check className="h-5 w-5 text-success" />
            </div>
          )}
        </div>
        {error && (
          <p
            id={`${props.id}-error`}
            className="mt-1 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
