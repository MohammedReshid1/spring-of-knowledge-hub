import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Badge } from "./badge"
import { cn } from "@/lib/utils"

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 font-medium",
  {
    variants: {
      variant: {
        // Grade variants
        "grade-a": "bg-grade-a/10 text-grade-a border-grade-a/20",
        "grade-b": "bg-grade-b/10 text-grade-b border-grade-b/20",
        "grade-c": "bg-grade-c/10 text-grade-c border-grade-c/20",
        "grade-d": "bg-grade-d/10 text-grade-d border-grade-d/20",
        "grade-f": "bg-grade-f/10 text-grade-f border-grade-f/20",
        
        // Attendance variants
        "attendance-present": "bg-attendance-present/10 text-attendance-present border-attendance-present/20",
        "attendance-absent": "bg-attendance-absent/10 text-attendance-absent border-attendance-absent/20",
        "attendance-late": "bg-attendance-late/10 text-attendance-late border-attendance-late/20",
        "attendance-excused": "bg-attendance-excused/10 text-attendance-excused border-attendance-excused/20",
        
        // Payment variants
        "payment-paid": "bg-payment-paid/10 text-payment-paid border-payment-paid/20",
        "payment-pending": "bg-payment-pending/10 text-payment-pending border-payment-pending/20",
        "payment-overdue": "bg-payment-overdue/10 text-payment-overdue border-payment-overdue/20",
        "payment-partial": "bg-payment-partial/10 text-payment-partial border-payment-partial/20",
        
        // Status variants
        "success": "bg-success/10 text-success border-success/20",
        "warning": "bg-warning/10 text-warning border-warning/20",
        "info": "bg-info/10 text-info border-info/20",
        "error": "bg-destructive/10 text-destructive border-destructive/20",
        
        // Educational variants
        "education-primary": "bg-education-primary/10 text-education-primary border-education-primary/20",
        "education-secondary": "bg-education-secondary/10 text-education-secondary border-education-secondary/20",
        "education-accent": "bg-education-accent/10 text-education-accent border-education-accent/20",
      },
      size: {
        sm: "text-xs px-2 py-0.5",
        md: "text-sm px-2.5 py-1",
        lg: "text-base px-3 py-1.5",
      },
      withDot: {
        true: "pl-1.5",
        false: "",
      },
    },
    defaultVariants: {
      variant: "info",
      size: "md",
      withDot: false,
    },
  }
)

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
  withDot?: boolean
}

const StatusBadge = React.forwardRef<HTMLDivElement, StatusBadgeProps>(
  ({ className, variant, size, withDot, children, ...props }, ref) => {
    return (
      <Badge
        className={cn(statusBadgeVariants({ variant, size, withDot, className }))}
        ref={ref}
        {...props}
      >
        {withDot && (
          <span 
            className={cn(
              "w-2 h-2 rounded-full",
              variant?.includes("grade-a") && "bg-grade-a",
              variant?.includes("grade-b") && "bg-grade-b",
              variant?.includes("grade-c") && "bg-grade-c",
              variant?.includes("grade-d") && "bg-grade-d",
              variant?.includes("grade-f") && "bg-grade-f",
              variant?.includes("attendance-present") && "bg-attendance-present",
              variant?.includes("attendance-absent") && "bg-attendance-absent",
              variant?.includes("attendance-late") && "bg-attendance-late",
              variant?.includes("attendance-excused") && "bg-attendance-excused",
              variant?.includes("payment-paid") && "bg-payment-paid",
              variant?.includes("payment-pending") && "bg-payment-pending",
              variant?.includes("payment-overdue") && "bg-payment-overdue",
              variant?.includes("payment-partial") && "bg-payment-partial",
              variant?.includes("success") && "bg-success",
              variant?.includes("warning") && "bg-warning",
              variant?.includes("info") && "bg-info",
              variant?.includes("error") && "bg-destructive",
            )}
            aria-hidden="true"
          />
        )}
        {children}
      </Badge>
    )
  }
)
StatusBadge.displayName = "StatusBadge"

export { StatusBadge, statusBadgeVariants }

// Helper functions for automatic badge selection
export const getGradeBadgeVariant = (grade: string): "grade-a" | "grade-b" | "grade-c" | "grade-d" | "grade-f" => {
  const upperGrade = grade.toUpperCase()
  if (upperGrade.startsWith('A')) return "grade-a"
  if (upperGrade.startsWith('B')) return "grade-b"
  if (upperGrade.startsWith('C')) return "grade-c"
  if (upperGrade.startsWith('D')) return "grade-d"
  return "grade-f"
}

export const getAttendanceBadgeVariant = (status: string): "attendance-present" | "attendance-absent" | "attendance-late" | "attendance-excused" => {
  switch (status.toLowerCase()) {
    case 'present':
      return "attendance-present"
    case 'absent':
      return "attendance-absent"
    case 'late':
      return "attendance-late"
    case 'excused':
      return "attendance-excused"
    default:
      return "attendance-present"
  }
}

export const getPaymentBadgeVariant = (status: string): "payment-paid" | "payment-pending" | "payment-overdue" | "payment-partial" => {
  switch (status.toLowerCase()) {
    case 'paid':
    case 'completed':
      return "payment-paid"
    case 'pending':
      return "payment-pending"
    case 'overdue':
    case 'failed':
      return "payment-overdue"
    case 'partial':
      return "payment-partial"
    default:
      return "payment-pending"
  }
}