import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Button } from "./button"
import { Card, CardContent, CardHeader, CardTitle } from "./card"
import { Alert, AlertDescription, AlertTitle } from "./alert"
import { 
  AlertTriangle, 
  RefreshCw, 
  Home, 
  ChevronDown, 
  ChevronUp,
  Bug,
  Wifi,
  Server
} from "lucide-react"

const errorVariants = cva(
  "w-full",
  {
    variants: {
      variant: {
        inline: "bg-transparent border-none shadow-none",
        card: "bg-card border border-border shadow-sm rounded-lg",
        alert: "border rounded-md",
        page: "min-h-[400px] flex items-center justify-center",
      },
      severity: {
        error: "text-destructive",
        warning: "text-warning",
        info: "text-info",
      },
    },
    defaultVariants: {
      variant: "card",
      severity: "error",
    },
  }
)

export interface ErrorDisplayProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof errorVariants> {
  title?: string
  description?: string
  error?: Error | string
  showDetails?: boolean
  onRetry?: () => void
  onGoHome?: () => void
  actions?: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
}

const ErrorDisplay = React.forwardRef<HTMLDivElement, ErrorDisplayProps>(
  ({ 
    className, 
    variant, 
    severity, 
    title, 
    description, 
    error, 
    showDetails = false,
    onRetry,
    onGoHome,
    actions,
    icon: Icon = AlertTriangle,
    ...props 
  }, ref) => {
    const [detailsOpen, setDetailsOpen] = React.useState(false)
    
    const errorMessage = error instanceof Error ? error.message : error
    const errorStack = error instanceof Error ? error.stack : undefined

    const getErrorType = (error: Error | string | undefined) => {
      if (!error) return "Unknown Error"
      
      const message = typeof error === 'string' ? error : error.message
      
      if (message.includes('Network') || message.includes('fetch')) return "Network Error"
      if (message.includes('401') || message.includes('Unauthorized')) return "Authentication Error"
      if (message.includes('403') || message.includes('Forbidden')) return "Permission Error"
      if (message.includes('404') || message.includes('Not Found')) return "Not Found"
      if (message.includes('500') || message.includes('Server')) return "Server Error"
      
      return "Application Error"
    }

    const getErrorIcon = (errorType: string) => {
      switch (errorType) {
        case "Network Error":
          return Wifi
        case "Server Error":
          return Server
        default:
          return Icon
      }
    }

    const errorType = getErrorType(error)
    const ErrorIcon = getErrorIcon(errorType)
    
    const defaultTitle = title || errorType
    const defaultDescription = description || errorMessage || "Something went wrong. Please try again."

    const renderContent = () => (
      <>
        <div className="flex items-start space-x-3">
          <ErrorIcon className={cn(
            "flex-shrink-0 mt-0.5",
            severity === "error" && "text-destructive",
            severity === "warning" && "text-warning", 
            severity === "info" && "text-info",
            variant === "page" ? "h-8 w-8" : "h-5 w-5"
          )} />
          <div className="flex-1 space-y-2">
            <div>
              <h3 className={cn(
                "font-semibold leading-none tracking-tight",
                variant === "page" ? "text-xl" : "text-base"
              )}>
                {defaultTitle}
              </h3>
              <p className={cn(
                "text-muted-foreground mt-1",
                variant === "page" ? "text-base" : "text-sm"
              )}>
                {defaultDescription}
              </p>
            </div>

            {/* Error Details */}
            {showDetails && error && (
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDetailsOpen(!detailsOpen)}
                  className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {detailsOpen ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" />
                      Hide Details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      Show Details
                    </>
                  )}
                </Button>
                
                {detailsOpen && (
                  <div className="bg-muted/50 rounded-md p-3 text-xs font-mono">
                    <p className="text-muted-foreground mb-2">Error Details:</p>
                    <p className="text-destructive mb-2">{errorMessage}</p>
                    {errorStack && (
                      <details className="text-muted-foreground">
                        <summary className="cursor-pointer hover:text-foreground">Stack Trace</summary>
                        <pre className="mt-2 whitespace-pre-wrap text-xs overflow-x-auto">
                          {errorStack}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              )}
              {onGoHome && (
                <Button variant="outline" size="sm" onClick={onGoHome}>
                  <Home className="h-4 w-4 mr-2" />
                  Go Home
                </Button>
              )}
              {actions}
            </div>
          </div>
        </div>
      </>
    )

    if (variant === "alert") {
      return (
        <Alert className={cn(className)} ref={ref} {...props}>
          <ErrorIcon className="h-4 w-4" />
          <AlertTitle>{defaultTitle}</AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <p>{defaultDescription}</p>
            {(onRetry || onGoHome || actions) && (
              <div className="flex flex-wrap gap-2 mt-3">
                {onRetry && (
                  <Button variant="outline" size="sm" onClick={onRetry}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                )}
                {onGoHome && (
                  <Button variant="outline" size="sm" onClick={onGoHome}>
                    <Home className="h-4 w-4 mr-2" />
                    Go Home
                  </Button>
                )}
                {actions}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )
    }

    if (variant === "card") {
      return (
        <Card className={cn(className)} ref={ref} {...props}>
          <CardContent className="p-6">
            {renderContent()}
          </CardContent>
        </Card>
      )
    }

    if (variant === "page") {
      return (
        <div className={cn(errorVariants({ variant, className }))} ref={ref} {...props}>
          <div className="text-center space-y-4 max-w-md mx-auto px-4">
            {renderContent()}
          </div>
        </div>
      )
    }

    return (
      <div className={cn(className)} ref={ref} {...props}>
        {renderContent()}
      </div>
    )
  }
)
ErrorDisplay.displayName = "ErrorDisplay"

// Error Boundary Component
interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error?: Error; retry?: () => void }>
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })
    this.props.onError?.(error, errorInfo)
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error Boundary caught an error:', error, errorInfo)
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent error={this.state.error} retry={this.handleRetry} />
      }

      return (
        <ErrorDisplay
          variant="page"
          title="Something went wrong"
          description="An unexpected error occurred. Please try refreshing the page."
          error={this.state.error}
          showDetails={process.env.NODE_ENV === 'development'}
          onRetry={this.handleRetry}
          onGoHome={() => window.location.href = '/'}
        />
      )
    }

    return this.props.children
  }
}

export { ErrorDisplay, ErrorBoundary, errorVariants }