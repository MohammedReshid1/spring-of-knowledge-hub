import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge, getGradeBadgeVariant, getAttendanceBadgeVariant, getPaymentBadgeVariant } from "@/components/ui/status-badge"
import { Loading, PageLoading, ContentLoading, TableLoading, WidgetLoading } from "@/components/ui/loading"
import { ErrorDisplay } from "@/components/ui/error-boundary"
import { FormField, validators, combineValidators } from "@/components/ui/form-field"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { 
  Palette, 
  Type, 
  Layout, 
  Zap, 
  Shield,
  Smartphone,
  Eye,
  CheckCircle2
} from "lucide-react"

export const DesignSystem: React.FC = () => {
  const [formData, setFormData] = React.useState({
    name: "",
    email: "",
    grade: "",
    status: "active"
  })

  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({})

  const validateField = (name: string, value: any) => {
    let validator
    switch (name) {
      case 'name':
        validator = combineValidators(validators.required, validators.minLength(2))
        break
      case 'email':
        validator = combineValidators(validators.required, validators.email)
        break
      case 'grade':
        validator = validators.required
        break
      default:
        return null
    }
    return validator(value)
  }

  const handleFieldChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }))
    const error = validateField(name, value)
    setFormErrors(prev => ({ ...prev, [name]: error || "" }))
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Spring of Knowledge Hub</h1>
        <h2 className="text-2xl font-semibold text-muted-foreground">Design System</h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Comprehensive design system for educational management platform with consistent UI patterns, 
          accessibility compliance, and mobile-first approach.
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="colors">Colors</TabsTrigger>
          <TabsTrigger value="typography">Typography</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="forms">Forms</TabsTrigger>
          <TabsTrigger value="states">States</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
          <TabsTrigger value="guidelines">Guidelines</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Palette className="h-5 w-5 mr-2" />
                  Educational Colors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Semantic color system designed for educational contexts with grade-specific, 
                  attendance, and payment status colors.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Type className="h-5 w-5 mr-2" />
                  Typography Scale
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Consistent typography hierarchy with design tokens for all text sizes, 
                  weights, and line heights.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Layout className="h-5 w-5 mr-2" />
                  Component Library
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Extended shadcn/ui components with educational-specific variants 
                  and consistent styling patterns.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Smartphone className="h-5 w-5 mr-2" />
                  Mobile First
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Responsive design patterns optimized for mobile devices with 
                  progressive enhancement for larger screens.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Design Principles</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <div className="flex items-center">
                  <Shield className="h-4 w-4 mr-2 text-education-primary" />
                  <h3 className="font-semibold">Accessibility First</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  WCAG 2.1 AA compliant with proper contrast ratios, keyboard navigation, 
                  and screen reader support.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center">
                  <Zap className="h-4 w-4 mr-2 text-education-secondary" />
                  <h3 className="font-semibold">Performance</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Optimized loading states, efficient animations, and minimal bundle impact 
                  for fast user experiences.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center">
                  <Eye className="h-4 w-4 mr-2 text-education-accent" />
                  <h3 className="font-semibold">Consistency</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Unified design language across all modules with predictable interactions 
                  and visual patterns.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="colors" className="space-y-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Core Colors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <div className="h-16 bg-primary rounded-md border"></div>
                    <p className="text-sm font-medium">Primary</p>
                    <code className="text-xs text-muted-foreground">hsl(var(--primary))</code>
                  </div>
                  <div className="space-y-2">
                    <div className="h-16 bg-secondary rounded-md border"></div>
                    <p className="text-sm font-medium">Secondary</p>
                    <code className="text-xs text-muted-foreground">hsl(var(--secondary))</code>
                  </div>
                  <div className="space-y-2">
                    <div className="h-16 bg-accent rounded-md border"></div>
                    <p className="text-sm font-medium">Accent</p>
                    <code className="text-xs text-muted-foreground">hsl(var(--accent))</code>
                  </div>
                  <div className="space-y-2">
                    <div className="h-16 bg-muted rounded-md border"></div>
                    <p className="text-sm font-medium">Muted</p>
                    <code className="text-xs text-muted-foreground">hsl(var(--muted))</code>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Educational Colors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6">
                  <div>
                    <h3 className="text-sm font-medium mb-3">Grade Colors</h3>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge variant="grade-a" withDot>Grade A</StatusBadge>
                      <StatusBadge variant="grade-b" withDot>Grade B</StatusBadge>
                      <StatusBadge variant="grade-c" withDot>Grade C</StatusBadge>
                      <StatusBadge variant="grade-d" withDot>Grade D</StatusBadge>
                      <StatusBadge variant="grade-f" withDot>Grade F</StatusBadge>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-3">Attendance Colors</h3>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge variant="attendance-present" withDot>Present</StatusBadge>
                      <StatusBadge variant="attendance-absent" withDot>Absent</StatusBadge>
                      <StatusBadge variant="attendance-late" withDot>Late</StatusBadge>
                      <StatusBadge variant="attendance-excused" withDot>Excused</StatusBadge>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-3">Payment Colors</h3>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge variant="payment-paid" withDot>Paid</StatusBadge>
                      <StatusBadge variant="payment-pending" withDot>Pending</StatusBadge>
                      <StatusBadge variant="payment-overdue" withDot>Overdue</StatusBadge>
                      <StatusBadge variant="payment-partial" withDot>Partial</StatusBadge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="typography" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Typography Scale</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h1 className="text-5xl font-bold">Heading 1 - 48px</h1>
                  <code className="text-sm text-muted-foreground">text-5xl font-bold</code>
                </div>
                <div className="space-y-2">
                  <h2 className="text-4xl font-semibold">Heading 2 - 36px</h2>
                  <code className="text-sm text-muted-foreground">text-4xl font-semibold</code>
                </div>
                <div className="space-y-2">
                  <h3 className="text-3xl font-medium">Heading 3 - 30px</h3>
                  <code className="text-sm text-muted-foreground">text-3xl font-medium</code>
                </div>
                <div className="space-y-2">
                  <h4 className="text-2xl font-medium">Heading 4 - 24px</h4>
                  <code className="text-sm text-muted-foreground">text-2xl font-medium</code>
                </div>
                <div className="space-y-2">
                  <p className="text-lg">Large Text - 18px</p>
                  <code className="text-sm text-muted-foreground">text-lg</code>
                </div>
                <div className="space-y-2">
                  <p className="text-base">Body Text - 16px</p>
                  <code className="text-sm text-muted-foreground">text-base</code>
                </div>
                <div className="space-y-2">
                  <p className="text-sm">Small Text - 14px</p>
                  <code className="text-sm text-muted-foreground">text-sm</code>
                </div>
                <div className="space-y-2">
                  <p className="text-xs">Extra Small - 12px</p>
                  <code className="text-sm text-muted-foreground">text-xs</code>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="components" className="space-y-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Buttons</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  <Button>Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button size="sm">Small</Button>
                  <Button size="lg">Large</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status Badges</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Auto-detection Examples</h4>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge variant={getGradeBadgeVariant("A+")} withDot>A+</StatusBadge>
                    <StatusBadge variant={getGradeBadgeVariant("B-")} withDot>B-</StatusBadge>
                    <StatusBadge variant={getAttendanceBadgeVariant("present")} withDot>Present</StatusBadge>
                    <StatusBadge variant={getPaymentBadgeVariant("overdue")} withDot>Overdue</StatusBadge>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-2">Sizes</h4>
                  <div className="flex flex-wrap gap-2 items-center">
                    <StatusBadge variant="success" size="sm">Small</StatusBadge>
                    <StatusBadge variant="warning" size="md">Medium</StatusBadge>
                    <StatusBadge variant="info" size="lg">Large</StatusBadge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="forms" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Form Components</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  label="Full Name"
                  type="text"
                  placeholder="Enter full name"
                  required
                  value={formData.name}
                  onChange={(value) => handleFieldChange('name', value)}
                  error={formErrors.name}
                />

                <FormField
                  label="Email Address"
                  type="email"
                  placeholder="Enter email address"
                  required
                  value={formData.email}
                  onChange={(value) => handleFieldChange('email', value)}
                  error={formErrors.email}
                />

                <FormField
                  label="Grade Level"
                  type="select"
                  placeholder="Select grade level"
                  required
                  value={formData.grade}
                  onChange={(value) => handleFieldChange('grade', value)}
                  error={formErrors.grade}
                  options={[
                    { label: "Grade 1", value: "1" },
                    { label: "Grade 2", value: "2" },
                    { label: "Grade 3", value: "3" },
                    { label: "Grade 4", value: "4" },
                    { label: "Grade 5", value: "5" },
                  ]}
                />

                <FormField
                  label="Student Status"
                  type="radio"
                  value={formData.status}
                  onChange={(value) => handleFieldChange('status', value)}
                  options={[
                    { label: "Active", value: "active" },
                    { label: "Inactive", value: "inactive" },
                    { label: "Graduated", value: "graduated" },
                  ]}
                />
              </div>

              <FormField
                label="Additional Notes"
                type="textarea"
                placeholder="Enter any additional notes..."
                description="Optional field for additional information"
                rows={4}
              />

              <FormField
                label="I agree to the terms and conditions"
                type="checkbox"
                required
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="states" className="space-y-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Loading States</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium mb-3">Loading Variants</h4>
                  <div className="flex flex-wrap gap-6">
                    <div className="text-center space-y-2">
                      <Loading variant="spinner" size="md" />
                      <p className="text-xs text-muted-foreground">Spinner</p>
                    </div>
                    <div className="text-center space-y-2">
                      <Loading variant="dots" size="md" />
                      <p className="text-xs text-muted-foreground">Dots</p>
                    </div>
                    <div className="text-center space-y-2">
                      <Loading variant="bars" size="md" />
                      <p className="text-xs text-muted-foreground">Bars</p>
                    </div>
                    <div className="text-center space-y-2">
                      <Loading variant="pulse" size="md" />
                      <p className="text-xs text-muted-foreground">Pulse</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-medium mb-3">Specialized Loading Components</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Content Loading</p>
                      <ContentLoading lines={3} showAvatar />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Widget Loading</p>
                      <WidgetLoading />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Error States</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ErrorDisplay
                  variant="alert"
                  title="Validation Error"
                  description="Please check the form fields and try again."
                  severity="error"
                  onRetry={() => {}}
                />

                <ErrorDisplay
                  variant="card"
                  title="Network Error"
                  description="Unable to connect to the server. Please check your connection."
                  severity="warning"
                  onRetry={() => {}}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Responsive Patterns</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Breakpoints</h4>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Small (sm)</span>
                    <code>640px+</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Medium (md)</span>
                    <code>768px+</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Large (lg)</span>
                    <code>1024px+</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Extra Large (xl)</span>
                    <code>1280px+</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">2X Large (2xl)</span>
                    <code>1400px+</code>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guidelines" className="space-y-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Usage Guidelines
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Color Usage</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                    <li>Use grade colors consistently across all academic displays</li>
                    <li>Apply attendance colors uniformly for status indicators</li>
                    <li>Maintain payment color meanings across all financial components</li>
                    <li>Ensure sufficient contrast ratios (minimum 4.5:1 for normal text)</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Component Usage</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                    <li>Use StatusBadge with helper functions for automatic color selection</li>
                    <li>Apply appropriate loading states based on content type</li>
                    <li>Implement error boundaries at page and component levels</li>
                    <li>Use FormField components for consistent validation patterns</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Accessibility</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                    <li>Always provide alt text for status indicators</li>
                    <li>Use semantic HTML elements within components</li>
                    <li>Ensure keyboard navigation works for all interactive elements</li>
                    <li>Test with screen readers regularly</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}