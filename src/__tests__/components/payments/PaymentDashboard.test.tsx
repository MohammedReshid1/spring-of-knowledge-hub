import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BranchProvider } from '@/contexts/BranchContext'
import PaymentDashboard from '@/components/payments/PaymentDashboard'

// Mock the API client
const mockApiClient = {
  payments: {
    getAll: vi.fn(),
    getSummary: vi.fn(),
    getRecentPayments: vi.fn(),
    getPaymentTrends: vi.fn()
  },
  dashboard: {
    getPaymentStats: vi.fn(),
    getPaymentChartData: vi.fn()
  }
}

vi.mock('@/lib/api', () => ({
  default: mockApiClient
}))

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  Line: () => <div data-testid="line" />,
  Cell: () => <div data-testid="cell" />,
  Pie: () => <div data-testid="pie" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  Area: () => <div data-testid="area" />,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>
}))

// Mock next/router
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  pathname: '/payments'
}

vi.mock('next/router', () => ({
  useRouter: () => mockRouter
}))

const mockBranch = {
  id: 'branch-1',
  name: 'Test Branch',
  code: 'TB'
}

const mockPaymentStats = {
  totalPayments: 150,
  totalAmount: 125000.00,
  totalDiscount: 5000.00,
  totalTax: 12500.00,
  averagePayment: 833.33,
  completedPayments: 145,
  pendingPayments: 5,
  cancelledPayments: 2,
  refundedPayments: 1,
  monthlyGrowth: 15.5,
  weeklyGrowth: 8.2,
  paymentMethodBreakdown: {
    cash: 75,
    card: 45,
    bank_transfer: 20,
    cheque: 8,
    online: 2
  },
  verificationStatus: {
    verified: 140,
    unverified: 8,
    rejected: 2
  }
}

const mockRecentPayments = [
  {
    id: 'payment-1',
    receiptNo: 'RCP001',
    studentName: 'John Doe',
    studentId: 'STU001',
    amount: 1000.00,
    paymentMethod: 'cash',
    status: 'completed',
    paymentDate: '2024-01-15T10:00:00Z',
    createdAt: '2024-01-15T09:30:00Z'
  },
  {
    id: 'payment-2',
    receiptNo: 'RCP002',
    studentName: 'Jane Smith',
    studentId: 'STU002',
    amount: 750.00,
    paymentMethod: 'card',
    status: 'pending',
    paymentDate: '2024-01-16T14:30:00Z',
    createdAt: '2024-01-16T14:00:00Z'
  }
]

const mockPaymentTrends = [
  { month: 'Jan', amount: 25000, payments: 30 },
  { month: 'Feb', amount: 28000, payments: 32 },
  { month: 'Mar', amount: 30000, payments: 35 },
  { month: 'Apr', amount: 32000, payments: 38 },
  { month: 'May', amount: 35000, payments: 40 },
  { month: 'Jun', amount: 38000, payments: 42 }
]

const mockChartData = {
  monthlyRevenue: mockPaymentTrends,
  paymentMethodDistribution: [
    { name: 'Cash', value: 75, color: '#8884d8' },
    { name: 'Card', value: 45, color: '#82ca9d' },
    { name: 'Bank Transfer', value: 20, color: '#ffc658' },
    { name: 'Cheque', value: 8, color: '#ff7c7c' },
    { name: 'Online', value: 2, color: '#8dd1e1' }
  ],
  weeklyTrends: [
    { day: 'Mon', amount: 8000 },
    { day: 'Tue', amount: 9500 },
    { day: 'Wed', amount: 7200 },
    { day: 'Thu', amount: 11000 },
    { day: 'Fri', amount: 9800 },
    { day: 'Sat', amount: 6500 },
    { day: 'Sun', amount: 4200 }
  ]
}

const renderPaymentDashboard = (props = {}) => {
  const defaultProps = {
    branchId: 'branch-1',
    ...props
  }

  return render(
    <BranchProvider>
      <PaymentDashboard {...defaultProps} />
    </BranchProvider>
  )
}

describe('PaymentDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockApiClient.dashboard.getPaymentStats.mockResolvedValue({
      success: true,
      data: mockPaymentStats
    })

    mockApiClient.payments.getRecentPayments.mockResolvedValue({
      success: true,
      data: mockRecentPayments
    })

    mockApiClient.payments.getPaymentTrends.mockResolvedValue({
      success: true,
      data: mockPaymentTrends
    })

    mockApiClient.dashboard.getPaymentChartData.mockResolvedValue({
      success: true,
      data: mockChartData
    })
  })

  describe('Dashboard Loading', () => {
    it('should show loading state initially', () => {
      // Mock delayed responses
      mockApiClient.dashboard.getPaymentStats.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 1000))
      )

      renderPaymentDashboard()

      expect(screen.getByTestId('payment-dashboard-loading')).toBeInTheDocument()
    })

    it('should load all dashboard data on mount', async () => {
      renderPaymentDashboard()

      await waitFor(() => {
        expect(mockApiClient.dashboard.getPaymentStats).toHaveBeenCalledWith('branch-1')
        expect(mockApiClient.payments.getRecentPayments).toHaveBeenCalledWith({
          branchId: 'branch-1',
          limit: 10
        })
        expect(mockApiClient.payments.getPaymentTrends).toHaveBeenCalledWith('branch-1')
        expect(mockApiClient.dashboard.getPaymentChartData).toHaveBeenCalledWith('branch-1')
      })
    })

    it('should handle API errors gracefully', async () => {
      mockApiClient.dashboard.getPaymentStats.mockRejectedValue(new Error('API Error'))

      renderPaymentDashboard()

      await waitFor(() => {
        expect(screen.getByText(/failed to load dashboard data/i)).toBeInTheDocument()
      })
    })
  })

  describe('Statistics Cards', () => {
    it('should display key payment statistics', async () => {
      renderPaymentDashboard()

      await waitFor(() => {
        expect(screen.getByText(/total payments/i)).toBeInTheDocument()
        expect(screen.getByText('150')).toBeInTheDocument()

        expect(screen.getByText(/total amount/i)).toBeInTheDocument()
        expect(screen.getByText('$125,000.00')).toBeInTheDocument()

        expect(screen.getByText(/average payment/i)).toBeInTheDocument()
        expect(screen.getByText('$833.33')).toBeInTheDocument()

        expect(screen.getByText(/monthly growth/i)).toBeInTheDocument()
        expect(screen.getByText('15.5%')).toBeInTheDocument()
      })
    })

    it('should display payment status breakdown', async () => {
      renderPaymentDashboard()

      await waitFor(() => {
        expect(screen.getByText(/completed.*145/i)).toBeInTheDocument()
        expect(screen.getByText(/pending.*5/i)).toBeInTheDocument()
        expect(screen.getByText(/cancelled.*2/i)).toBeInTheDocument()
        expect(screen.getByText(/refunded.*1/i)).toBeInTheDocument()
      })
    })

    it('should show growth indicators with correct styling', async () => {
      renderPaymentDashboard()

      await waitFor(() => {
        const monthlyGrowth = screen.getByText('15.5%')
        expect(monthlyGrowth.closest('div')).toHaveClass('text-success')

        const weeklyGrowth = screen.getByText('8.2%')
        expect(weeklyGrowth.closest('div')).toHaveClass('text-success')
      })
    })

    it('should handle negative growth indicators', async () => {
      const statsWithNegativeGrowth = {
        ...mockPaymentStats,
        monthlyGrowth: -5.2,
        weeklyGrowth: -2.1
      }

      mockApiClient.dashboard.getPaymentStats.mockResolvedValue({
        success: true,
        data: statsWithNegativeGrowth
      })

      renderPaymentDashboard()

      await waitFor(() => {
        const monthlyGrowth = screen.getByText('-5.2%')
        expect(monthlyGrowth.closest('div')).toHaveClass('text-danger')
      })
    })
  })

  describe('Charts and Visualizations', () => {
    it('should render revenue trend chart', async () => {
      renderPaymentDashboard()

      await waitFor(() => {
        expect(screen.getByText(/revenue trends/i)).toBeInTheDocument()
        expect(screen.getByTestId('line-chart')).toBeInTheDocument()
      })
    })

    it('should render payment method distribution pie chart', async () => {
      renderPaymentDashboard()

      await waitFor(() => {
        expect(screen.getByText(/payment methods/i)).toBeInTheDocument()
        expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
      })
    })

    it('should render weekly trends bar chart', async () => {
      renderPaymentDashboard()

      await waitFor(() => {
        expect(screen.getByText(/weekly trends/i)).toBeInTheDocument()
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
      })
    })

    it('should handle chart data loading states', async () => {
      mockApiClient.dashboard.getPaymentChartData.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 1000))
      )

      renderPaymentDashboard()

      expect(screen.getAllByTestId('chart-loading')).toHaveLength(3)
    })

    it('should show empty state when no chart data available', async () => {
      mockApiClient.dashboard.getPaymentChartData.mockResolvedValue({
        success: true,
        data: {
          monthlyRevenue: [],
          paymentMethodDistribution: [],
          weeklyTrends: []
        }
      })

      renderPaymentDashboard()

      await waitFor(() => {
        expect(screen.getAllByText(/no data available/i)).toHaveLength(3)
      })
    })
  })

  describe('Recent Payments Table', () => {
    it('should display recent payments table', async () => {
      renderPaymentDashboard()

      await waitFor(() => {
        expect(screen.getByText(/recent payments/i)).toBeInTheDocument()
        expect(screen.getByText('RCP001')).toBeInTheDocument()
        expect(screen.getByText('John Doe (STU001)')).toBeInTheDocument()
        expect(screen.getByText('$1,000.00')).toBeInTheDocument()
        expect(screen.getByText('Cash')).toBeInTheDocument()
      })
    })

    it('should show payment status badges with correct styling', async () => {
      renderPaymentDashboard()

      await waitFor(() => {
        const completedBadge = screen.getByText('Completed')
        expect(completedBadge).toHaveClass('bg-success')

        const pendingBadge = screen.getByText('Pending')
        expect(pendingBadge).toHaveClass('bg-warning')
      })
    })

    it('should navigate to payment details when row is clicked', async () => {
      const user = userEvent.setup()
      renderPaymentDashboard()

      await waitFor(() => {
        expect(screen.getByText('RCP001')).toBeInTheDocument()
      })

      const paymentRow = screen.getByText('RCP001').closest('tr')
      await user.click(paymentRow!)

      expect(mockRouter.push).toHaveBeenCalledWith('/payments/payment-1')
    })

    it('should show "View All" link', async () => {
      renderPaymentDashboard()

      await waitFor(() => {
        expect(screen.getByText(/view all payments/i)).toBeInTheDocument()
      })

      const viewAllLink = screen.getByText(/view all payments/i)
      await userEvent.click(viewAllLink)

      expect(mockRouter.push).toHaveBeenCalledWith('/payments')
    })

    it('should handle empty recent payments', async () => {
      mockApiClient.payments.getRecentPayments.mockResolvedValue({
        success: true,
        data: []
      })

      renderPaymentDashboard()

      await waitFor(() => {
        expect(screen.getByText(/no recent payments/i)).toBeInTheDocument()
      })
    })
  })

  describe('Time Period Filters', () => {
    it('should render time period selector', async () => {
      renderPaymentDashboard()

      await waitFor(() => {
        expect(screen.getByLabelText(/time period/i)).toBeInTheDocument()
      })
    })

    it('should update dashboard data when time period changes', async () => {
      const user = userEvent.setup()
      renderPaymentDashboard()

      await waitFor(() => {
        expect(screen.getByLabelText(/time period/i)).toBeInTheDocument()
      })

      const periodSelect = screen.getByLabelText(/time period/i)
      await user.click(periodSelect)
      await user.click(screen.getByText(/last 3 months/i))

      await waitFor(() => {
        expect(mockApiClient.dashboard.getPaymentStats).toHaveBeenCalledWith(
          'branch-1',
          { period: 'last_3_months' }
        )
      })
    })

    it('should provide predefined time period options', async () => {
      const user = userEvent.setup()
      renderPaymentDashboard()

      await waitFor(() => {
        expect(screen.getByLabelText(/time period/i)).toBeInTheDocument()
      })

      const periodSelect = screen.getByLabelText(/time period/i)
      await user.click(periodSelect)

      expect(screen.getByText(/last 7 days/i)).toBeInTheDocument()
      expect(screen.getByText(/last 30 days/i)).toBeInTheDocument()
      expect(screen.getByText(/last 3 months/i)).toBeInTheDocument()
      expect(screen.getByText(/last 6 months/i)).toBeInTheDocument()
      expect(screen.getByText(/last year/i)).toBeInTheDocument()
    })

    it('should allow custom date range selection', async () => {
      const user = userEvent.setup()
      renderPaymentDashboard()

      await waitFor(() => {
        expect(screen.getByLabelText(/time period/i)).toBeInTheDocument()
      })

      const periodSelect = screen.getByLabelText(/time period/i)
      await user.click(periodSelect)
      await user.click(screen.getByText(/custom range/i))

      await waitFor(() => {
        expect(screen.getByLabelText(/from date/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/to date/i)).toBeInTheDocument()
      })

      const fromDate = screen.getByLabelText(/from date/i)
      const toDate = screen.getByLabelText(/to date/i)

      await user.type(fromDate, '2024-01-01')
      await user.type(toDate, '2024-01-31')

      const applyButton = screen.getByRole('button', { name: /apply/i })
      await user.click(applyButton)

      await waitFor(() => {
        expect(mockApiClient.dashboard.getPaymentStats).toHaveBeenCalledWith(
          'branch-1',
          { fromDate: '2024-01-01', toDate: '2024-01-31' }
        )
      })
    })
  })

  describe('Action Buttons', () => {
    it('should render quick action buttons', async () => {
      renderPaymentDashboard()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new payment/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /bulk import/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /export data/i })).toBeInTheDocument()
      })
    })

    it('should navigate to payment creation when "New Payment" is clicked', async () => {
      const user = userEvent.setup()
      renderPaymentDashboard()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new payment/i })).toBeInTheDocument()
      })

      const newPaymentButton = screen.getByRole('button', { name: /new payment/i })
      await user.click(newPaymentButton)

      expect(mockRouter.push).toHaveBeenCalledWith('/payments/new')
    })

    it('should open bulk import modal when "Bulk Import" is clicked', async () => {
      const user = userEvent.setup()
      renderPaymentDashboard()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /bulk import/i })).toBeInTheDocument()
      })

      const bulkImportButton = screen.getByRole('button', { name: /bulk import/i })
      await user.click(bulkImportButton)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText(/bulk import payments/i)).toBeInTheDocument()
      })
    })

    it('should trigger export when "Export Data" is clicked', async () => {
      const user = userEvent.setup()
      const mockBlob = new Blob(['csv,data'], { type: 'text/csv' })
      global.URL.createObjectURL = vi.fn(() => 'blob:url')

      mockApiClient.payments.getAll.mockResolvedValue({
        success: true,
        data: mockRecentPayments
      })

      renderPaymentDashboard()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export data/i })).toBeInTheDocument()
      })

      const exportButton = screen.getByRole('button', { name: /export data/i })
      await user.click(exportButton)

      // Should show export options
      await waitFor(() => {
        expect(screen.getByText(/export as csv/i)).toBeInTheDocument()
        expect(screen.getByText(/export as excel/i)).toBeInTheDocument()
      })
    })
  })

  describe('Refresh Functionality', () => {
    it('should provide refresh button', async () => {
      renderPaymentDashboard()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
      })
    })

    it('should refresh all data when refresh button is clicked', async () => {
      const user = userEvent.setup()
      renderPaymentDashboard()

      await waitFor(() => {
        expect(mockApiClient.dashboard.getPaymentStats).toHaveBeenCalledTimes(1)
      })

      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      await user.click(refreshButton)

      await waitFor(() => {
        expect(mockApiClient.dashboard.getPaymentStats).toHaveBeenCalledTimes(2)
        expect(mockApiClient.payments.getRecentPayments).toHaveBeenCalledTimes(2)
        expect(mockApiClient.payments.getPaymentTrends).toHaveBeenCalledTimes(2)
        expect(mockApiClient.dashboard.getPaymentChartData).toHaveBeenCalledTimes(2)
      })
    })

    it('should auto-refresh data periodically', async () => {
      vi.useFakeTimers()

      renderPaymentDashboard({ autoRefresh: true, refreshInterval: 30000 })

      await waitFor(() => {
        expect(mockApiClient.dashboard.getPaymentStats).toHaveBeenCalledTimes(1)
      })

      // Advance timer by 30 seconds
      vi.advanceTimersByTime(30000)

      await waitFor(() => {
        expect(mockApiClient.dashboard.getPaymentStats).toHaveBeenCalledTimes(2)
      })

      vi.useRealTimers()
    })
  })

  describe('Responsive Design', () => {
    it('should adapt layout for mobile screens', async () => {
      // Mock window.innerWidth
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 320
      })

      renderPaymentDashboard()

      await waitFor(() => {
        const dashboard = screen.getByTestId('payment-dashboard')
        expect(dashboard).toHaveClass('mobile-layout')
      })
    })

    it('should stack cards vertically on small screens', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768
      })

      renderPaymentDashboard()

      await waitFor(() => {
        const statsGrid = screen.getByTestId('stats-grid')
        expect(statsGrid).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-4')
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', async () => {
      renderPaymentDashboard()

      await waitFor(() => {
        expect(screen.getByRole('main')).toHaveAttribute('aria-label', /payment dashboard/i)
        expect(screen.getByRole('region', { name: /statistics/i })).toBeInTheDocument()
        expect(screen.getByRole('region', { name: /charts/i })).toBeInTheDocument()
        expect(screen.getByRole('region', { name: /recent payments/i })).toBeInTheDocument()
      })
    })

    it('should provide keyboard navigation for interactive elements', async () => {
      const user = userEvent.setup()
      renderPaymentDashboard()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new payment/i })).toBeInTheDocument()
      })

      // Tab through interactive elements
      await user.tab()
      expect(screen.getByLabelText(/time period/i)).toHaveFocus()

      await user.tab()
      expect(screen.getByRole('button', { name: /refresh/i })).toHaveFocus()

      await user.tab()
      expect(screen.getByRole('button', { name: /new payment/i })).toHaveFocus()
    })

    it('should announce data updates to screen readers', async () => {
      renderPaymentDashboard()

      await waitFor(() => {
        const statsSection = screen.getByRole('region', { name: /statistics/i })
        expect(statsSection).toHaveAttribute('aria-live', 'polite')
      })
    })
  })
})