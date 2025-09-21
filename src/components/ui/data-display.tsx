import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "./card"
import { Badge } from "./badge"
import { StatusBadge, getGradeBadgeVariant, getAttendanceBadgeVariant, getPaymentBadgeVariant } from "./status-badge"
import { Loading } from "./loading"
import { ErrorDisplay } from "./error-boundary"
import { 
  User, 
  GraduationCap, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Minus,
  Clock,
  Award,
  BookOpen,
  CheckCircle2,
  AlertCircle
} from "lucide-react"

// Data Table Component
export interface DataTableProps {
  title?: string
  data: Array<Record<string, any>>
  columns: Array<{
    key: string
    label: string
    type?: 'text' | 'number' | 'date' | 'status' | 'currency' | 'grade' | 'attendance' | 'payment'
    formatter?: (value: any, row: any) => React.ReactNode
    className?: string
  }>
  loading?: boolean
  error?: string | Error
  onRetry?: () => void
  emptyMessage?: string
  actions?: Array<{
    label: string
    onClick: (row: any) => void
    variant?: 'default' | 'destructive' | 'outline'
  }>
}

export const DataTable: React.FC<DataTableProps> = ({
  title,
  data,
  columns,
  loading,
  error,
  onRetry,
  emptyMessage = "No data available",
  actions
}) => {
  const formatCellValue = (value: any, type: string = 'text', row: any) => {
    if (value === null || value === undefined) return '-'

    switch (type) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(value)
      
      case 'date':
        return new Date(value).toLocaleDateString()
      
      case 'grade':
        return <StatusBadge variant={getGradeBadgeVariant(value)} size="sm">{value}</StatusBadge>
      
      case 'attendance':
        return <StatusBadge variant={getAttendanceBadgeVariant(value)} size="sm" withDot>{value}</StatusBadge>
      
      case 'payment':
        return <StatusBadge variant={getPaymentBadgeVariant(value)} size="sm" withDot>{value}</StatusBadge>
      
      case 'status':
        const variant = value.toLowerCase().includes('active') ? 'success' : 
                      value.toLowerCase().includes('pending') ? 'warning' : 
                      value.toLowerCase().includes('error') ? 'error' : 'info'
        return <StatusBadge variant={variant} size="sm">{value}</StatusBadge>
      
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : value
      
      default:
        return value
    }
  }

  if (loading) {
    return (
      <Card>
        {title && (
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex space-x-4">
                {columns.map((_, j) => (
                  <div key={j} className="h-4 bg-muted animate-pulse rounded flex-1" />
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        {title && (
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <ErrorDisplay
            variant="inline"
            description="Failed to load data"
            error={error}
            onRetry={onRetry}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  {columns.map((column) => (
                    <th 
                      key={column.key} 
                      className={cn(
                        "text-left p-2 font-medium text-sm text-muted-foreground",
                        column.className
                      )}
                    >
                      {column.label}
                    </th>
                  ))}
                  {actions && actions.length > 0 && (
                    <th className="text-left p-2 font-medium text-sm text-muted-foreground">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.map((row, index) => (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    {columns.map((column) => (
                      <td key={column.key} className={cn("p-2", column.className)}>
                        {column.formatter 
                          ? column.formatter(row[column.key], row)
                          : formatCellValue(row[column.key], column.type, row)
                        }
                      </td>
                    ))}
                    {actions && actions.length > 0 && (
                      <td className="p-2">
                        <div className="flex space-x-2">
                          {actions.map((action, actionIndex) => (
                            <button
                              key={actionIndex}
                              onClick={() => action.onClick(row)}
                              className={cn(
                                "px-2 py-1 text-xs rounded",
                                action.variant === 'destructive' && "bg-destructive text-destructive-foreground",
                                action.variant === 'outline' && "border border-input bg-background",
                                (!action.variant || action.variant === 'default') && "bg-primary text-primary-foreground"
                              )}
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Stat Card Component
export interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  loading?: boolean
}

const statCardVariants = cva(
  "p-6 rounded-lg border",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        success: "bg-success/10 border-success/20 text-success-foreground",
        warning: "bg-warning/10 border-warning/20 text-warning-foreground",  
        error: "bg-destructive/10 border-destructive/20 text-destructive-foreground",
        info: "bg-info/10 border-info/20 text-info-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  icon: Icon,
  trend,
  trendValue,
  variant = 'default',
  loading
}) => {
  if (loading) {
    return (
      <div className={statCardVariants({ variant })}>
        <div className="flex items-center justify-between space-x-4">
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-muted animate-pulse rounded" />
            <div className="h-8 bg-muted animate-pulse rounded w-2/3" />
            <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
          </div>
          <div className="w-8 h-8 bg-muted animate-pulse rounded" />
        </div>
      </div>
    )
  }

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  return (
    <div className={statCardVariants({ variant })}>
      <div className="flex items-center justify-between space-x-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          {trend && trendValue && (
            <div className="flex items-center space-x-1">
              <TrendIcon className={cn(
                "h-3 w-3",
                trend === 'up' && "text-success",
                trend === 'down' && "text-destructive",
                trend === 'neutral' && "text-muted-foreground"
              )} />
              <span className={cn(
                "text-xs font-medium",
                trend === 'up' && "text-success",
                trend === 'down' && "text-destructive", 
                trend === 'neutral' && "text-muted-foreground"
              )}>
                {trendValue}
              </span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn(
            "p-2 rounded-full",
            variant === 'default' && "bg-primary/10 text-primary",
            variant === 'success' && "bg-success/20 text-success",
            variant === 'warning' && "bg-warning/20 text-warning",
            variant === 'error' && "bg-destructive/20 text-destructive",
            variant === 'info' && "bg-info/20 text-info"
          )}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
    </div>
  )
}

// Student Summary Card
export interface StudentSummaryProps {
  student: {
    id: string
    full_name: string
    grade_level: string
    class_name?: string
    overall_grade?: string
    attendance_percentage?: number
    behavior_points?: number
    outstanding_balance?: number
    photo_url?: string
  }
  onClick?: (student: any) => void
  loading?: boolean
}

export const StudentSummaryCard: React.FC<StudentSummaryProps> = ({
  student,
  onClick,
  loading
}) => {
  if (loading) {
    return (
      <Card className="cursor-pointer hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-muted animate-pulse rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
              <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onClick?.(student)}
    >
      <CardContent className="p-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold">
            {student.photo_url ? (
              <img 
                src={student.photo_url} 
                alt={student.full_name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              student.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm truncate">{student.full_name}</h3>
              {student.overall_grade && (
                <StatusBadge variant={getGradeBadgeVariant(student.overall_grade)} size="sm">
                  {student.overall_grade}
                </StatusBadge>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground">
              {student.grade_level}{student.class_name && ` - ${student.class_name}`}
            </p>
            
            <div className="flex items-center space-x-3 mt-2">
              {student.attendance_percentage !== undefined && (
                <div className="flex items-center space-x-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className={cn(
                    "text-xs",
                    student.attendance_percentage >= 95 ? "text-success" :
                    student.attendance_percentage >= 90 ? "text-info" :
                    student.attendance_percentage >= 85 ? "text-warning" : "text-destructive"
                  )}>
                    {student.attendance_percentage.toFixed(1)}%
                  </span>
                </div>
              )}
              
              {student.behavior_points !== undefined && (
                <div className="flex items-center space-x-1">
                  <Award className="h-3 w-3 text-muted-foreground" />
                  <span className={cn(
                    "text-xs",
                    student.behavior_points >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {student.behavior_points} pts
                  </span>
                </div>
              )}
              
              {student.outstanding_balance !== undefined && (
                <div className="flex items-center space-x-1">
                  <DollarSign className="h-3 w-3 text-muted-foreground" />
                  <span className={cn(
                    "text-xs",
                    student.outstanding_balance === 0 ? "text-success" : "text-warning"
                  )}>
                    ${student.outstanding_balance.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}