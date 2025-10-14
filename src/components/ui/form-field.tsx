import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Label } from "./label"
import { Input } from "./input"
import { Textarea } from "./textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"
import { Checkbox } from "./checkbox"
import { RadioGroup, RadioGroupItem } from "./radio-group"
import { AlertTriangle, CheckCircle, Info } from "lucide-react"

const formFieldVariants = cva(
  "space-y-2",
  {
    variants: {
      variant: {
        default: "",
        success: "",
        warning: "",
        error: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface FormFieldProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'>,
    VariantProps<typeof formFieldVariants> {
  label?: string
  description?: string
  error?: string
  success?: string
  warning?: string
  required?: boolean
  disabled?: boolean
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'textarea' | 'select' | 'checkbox' | 'radio'
  placeholder?: string
  value?: any
  onChange?: (value: any) => void
  options?: Array<{ label: string; value: string | number }>
  rows?: number
  min?: number
  max?: number
  step?: number
  children?: React.ReactNode
}

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ 
    className, 
    variant, 
    label, 
    description, 
    error, 
    success, 
    warning,
    required,
    disabled,
    type = 'text',
    placeholder,
    value,
    onChange,
    options = [],
    rows = 3,
    min,
    max,
    step,
    children,
    ...props 
  }, ref) => {
    // Determine variant based on validation state
    const effectiveVariant = error ? 'error' : success ? 'success' : warning ? 'warning' : variant

    const fieldId = React.useId()
    const descriptionId = description ? `${fieldId}-description` : undefined
    const errorId = error ? `${fieldId}-error` : undefined

    const renderInput = () => {
      const commonProps = {
        id: fieldId,
        placeholder,
        disabled,
        value,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          onChange?.(e.target.value)
        },
        'aria-describedby': cn(descriptionId, errorId),
        'aria-invalid': !!error,
        className: cn(
          effectiveVariant === 'error' && "border-destructive focus-visible:ring-destructive",
          effectiveVariant === 'success' && "border-success focus-visible:ring-success",
          effectiveVariant === 'warning' && "border-warning focus-visible:ring-warning"
        )
      }

      switch (type) {
        case 'textarea':
          return <Textarea {...commonProps} rows={rows} />
        
        case 'select':
          return (
            <Select 
              value={value?.toString()} 
              onValueChange={(val) => onChange?.(val)}
              disabled={disabled}
            >
              <SelectTrigger 
                id={fieldId}
                aria-describedby={cn(descriptionId, errorId)}
                aria-invalid={!!error}
                className={cn(
                  effectiveVariant === 'error' && "border-destructive focus:ring-destructive",
                  effectiveVariant === 'success' && "border-success focus:ring-success",
                  effectiveVariant === 'warning' && "border-warning focus:ring-warning"
                )}
              >
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        
        case 'checkbox':
          return (
            <div className="flex items-center space-x-2">
              <Checkbox
                id={fieldId}
                checked={value}
                onCheckedChange={onChange}
                disabled={disabled}
                aria-describedby={cn(descriptionId, errorId)}
                aria-invalid={!!error}
                className={cn(
                  effectiveVariant === 'error' && "border-destructive data-[state=checked]:bg-destructive",
                  effectiveVariant === 'success' && "border-success data-[state=checked]:bg-success",
                  effectiveVariant === 'warning' && "border-warning data-[state=checked]:bg-warning"
                )}
              />
              {label && (
                <Label
                  htmlFor={fieldId}
                  className={cn(
                    "text-sm font-normal",
                    disabled && "text-muted-foreground cursor-not-allowed"
                  )}
                >
                  {label} {required && <span className="text-destructive">*</span>}
                </Label>
              )}
            </div>
          )
        
        case 'radio':
          return (
            <RadioGroup
              value={value?.toString()}
              onValueChange={onChange}
              disabled={disabled}
              className="space-y-2"
            >
              {options.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={option.value.toString()}
                    id={`${fieldId}-${option.value}`}
                    aria-describedby={cn(descriptionId, errorId)}
                  />
                  <Label htmlFor={`${fieldId}-${option.value}`} className="text-sm font-normal">
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )
        
        default:
          return (
            <Input 
              {...commonProps}
              type={type}
              min={min}
              max={max}
              step={step}
            />
          )
      }
    }

    return (
      <div
        className={cn(formFieldVariants({ variant: effectiveVariant, className }))}
        ref={ref}
        {...props}
      >
        {/* Label (not rendered for checkbox since it's inline) */}
        {label && type !== 'checkbox' && (
          <Label 
            htmlFor={fieldId}
            className={cn(
              "text-sm font-medium",
              disabled && "text-muted-foreground cursor-not-allowed"
            )}
          >
            {label} {required && <span className="text-destructive">*</span>}
          </Label>
        )}

        {/* Description */}
        {description && (
          <p 
            id={descriptionId}
            className="text-sm text-muted-foreground"
          >
            {description}
          </p>
        )}

        {/* Input */}
        {children || renderInput()}

        {/* Validation Messages */}
        {error && (
          <div 
            id={errorId}
            className="flex items-center space-x-1 text-sm text-destructive"
          >
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && !error && (
          <div className="flex items-center space-x-1 text-sm text-success">
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {warning && !error && !success && (
          <div className="flex items-center space-x-1 text-sm text-warning">
            <Info className="h-4 w-4 flex-shrink-0" />
            <span>{warning}</span>
          </div>
        )}
      </div>
    )
  }
)
FormField.displayName = "FormField"

export { FormField, formFieldVariants }

// Form validation utilities
export const validators = {
  required: (value: any) => {
    if (value === null || value === undefined || value === '') {
      return 'This field is required'
    }
    return null
  },
  
  email: (value: string) => {
    if (!value) return null
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(value) ? null : 'Please enter a valid email address'
  },
  
  minLength: (min: number) => (value: string) => {
    if (!value) return null
    return value.length >= min ? null : `Must be at least ${min} characters long`
  },
  
  maxLength: (max: number) => (value: string) => {
    if (!value) return null
    return value.length <= max ? null : `Must be no more than ${max} characters long`
  },
  
  number: (value: string) => {
    if (!value) return null
    return !isNaN(Number(value)) ? null : 'Please enter a valid number'
  },
  
  phone: (value: string) => {
    if (!value) return null
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/
    return phoneRegex.test(value) ? null : 'Please enter a valid phone number'
  },
  
  url: (value: string) => {
    if (!value) return null
    try {
      new URL(value)
      return null
    } catch {
      return 'Please enter a valid URL'
    }
  },
  
  studentId: (value: string) => {
    if (!value) return null
    const studentIdRegex = /^[A-Z0-9]{6,12}$/
    return studentIdRegex.test(value) ? null : 'Student ID must be 6-12 characters (letters and numbers only)'
  }
}

// Combine multiple validators
export const combineValidators = (...validators: Array<(value: any) => string | null>) => {
  return (value: any) => {
    for (const validator of validators) {
      const error = validator(value)
      if (error) return error
    }
    return null
  }
}