import * as React from "react"
import { cn } from "@/lib/utils"

export interface FormFieldProps {
  children: React.ReactNode
  label?: string
  description?: string
  error?: string
  required?: boolean
  className?: string
  htmlFor?: string
}

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  (
    { children, label, description, error, required = false, className, htmlFor },
    ref
  ) => {
    return (
      <div ref={ref} className={cn("space-y-2", className)}>
        {label && (
          <label
            htmlFor={htmlFor}
            className="block text-sm font-medium text-foreground"
          >
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </label>
        )}
        {description && !error && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        {children}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }
)
FormField.displayName = "FormField"

export interface FormProps extends React.ComponentProps<"form"> {
  children: React.ReactNode
}

const Form = React.forwardRef<HTMLFormElement, FormProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <form ref={ref} className={cn("space-y-6", className)} {...props}>
        {children}
      </form>
    )
  }
)
Form.displayName = "Form"

export { FormField, Form }
