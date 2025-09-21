import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Skeleton } from "./skeleton"

const loadingVariants = cva(
  "flex items-center justify-center",
  {
    variants: {
      variant: {
        spinner: "animate-spin rounded-full border-2 border-muted-foreground border-t-primary",
        dots: "space-x-1",
        pulse: "animate-pulse",
        bars: "space-x-1",
      },
      size: {
        sm: "",
        md: "",
        lg: "",
        xl: "",
      },
    },
    compoundVariants: [
      {
        variant: "spinner",
        size: "sm",
        className: "h-4 w-4",
      },
      {
        variant: "spinner",
        size: "md",
        className: "h-6 w-6",
      },
      {
        variant: "spinner",
        size: "lg",
        className: "h-8 w-8",
      },
      {
        variant: "spinner",
        size: "xl",
        className: "h-12 w-12",
      },
    ],
    defaultVariants: {
      variant: "spinner",
      size: "md",
    },
  }
)

export interface LoadingProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof loadingVariants> {
  text?: string
}

const Loading = React.forwardRef<HTMLDivElement, LoadingProps>(
  ({ className, variant, size, text, ...props }, ref) => {
    const renderContent = () => {
      switch (variant) {
        case "dots":
          return (
            <div className="flex space-x-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "bg-primary rounded-full animate-bounce",
                    size === "sm" && "h-1.5 w-1.5",
                    size === "md" && "h-2 w-2",
                    size === "lg" && "h-3 w-3",
                    size === "xl" && "h-4 w-4"
                  )}
                  style={{
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: "0.6s"
                  }}
                />
              ))}
            </div>
          )
        case "bars":
          return (
            <div className="flex space-x-1 items-end">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "bg-primary animate-pulse",
                    size === "sm" && "w-1 h-4",
                    size === "md" && "w-1.5 h-6",
                    size === "lg" && "w-2 h-8",
                    size === "xl" && "w-3 h-12"
                  )}
                  style={{
                    animationDelay: `${i * 0.15}s`,
                    animationDuration: "1.2s"
                  }}
                />
              ))}
            </div>
          )
        case "pulse":
          return (
            <div
              className={cn(
                "bg-primary rounded-full animate-pulse",
                size === "sm" && "h-4 w-4",
                size === "md" && "h-6 w-6",
                size === "lg" && "h-8 w-8",
                size === "xl" && "h-12 w-12"
              )}
            />
          )
        default: // spinner
          return <div />
      }
    }

    return (
      <div
        className={cn(
          loadingVariants({ variant, size, className }),
          text && "flex-col space-y-2"
        )}
        ref={ref}
        {...props}
      >
        {renderContent()}
        {text && (
          <p className={cn(
            "text-muted-foreground animate-pulse",
            size === "sm" && "text-xs",
            size === "md" && "text-sm",
            size === "lg" && "text-base",
            size === "xl" && "text-lg"
          )}>
            {text}
          </p>
        )}
      </div>
    )
  }
)
Loading.displayName = "Loading"

// Page-level loading component
const PageLoading: React.FC<{ message?: string }> = ({ 
  message = "Loading..." 
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <Loading variant="spinner" size="lg" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  )
}

// Card/Section loading skeleton
const ContentLoading: React.FC<{ 
  lines?: number
  showAvatar?: boolean 
}> = ({ 
  lines = 3, 
  showAvatar = false 
}) => {
  return (
    <div className="space-y-4">
      {showAvatar && (
        <div className="flex items-center space-x-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      )}
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton 
            key={i} 
            className={cn(
              "h-4",
              i === lines - 1 ? "w-3/4" : "w-full"
            )}
          />
        ))}
      </div>
    </div>
  )
}

// Table loading skeleton
const TableLoading: React.FC<{ 
  rows?: number
  cols?: number 
}> = ({ 
  rows = 5, 
  cols = 4 
}) => {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`header-${i}`} className="h-8 w-full" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div 
          key={`row-${rowIndex}`} 
          className="grid gap-4" 
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Skeleton key={`cell-${rowIndex}-${colIndex}`} className="h-6 w-full" />
          ))}
        </div>
      ))}
    </div>
  )
}

// Dashboard widget loading
const WidgetLoading: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        <div className="flex justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  )
}

export { 
  Loading, 
  loadingVariants,
  PageLoading,
  ContentLoading,
  TableLoading,
  WidgetLoading
}