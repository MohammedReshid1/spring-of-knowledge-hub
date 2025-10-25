import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Upload, FileText, Settings, BarChart3, CreditCard, DollarSign, TrendingUp, Receipt, AlertCircle } from 'lucide-react';
import { PaymentDashboard } from '@/components/payments/PaymentDashboard';
import { PaymentForm } from '@/components/payments/PaymentForm';
import { PaymentList } from '@/components/payments/PaymentList';
import { PaymentReports } from '@/components/payments/PaymentReports';
import { FeeCategoryManagement } from '@/components/payments/FeeCategoryManagement';
import { BulkPaymentImport } from '@/components/payments/BulkPaymentImport';
import { UnpaidQuarterlyFees } from '@/components/payments/UnpaidQuarterlyFees';
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLiveDataForPage } from '@/hooks/useLiveData';
import type { Payment } from '@/types/api';

export default function PaymentsPage() {
  // Enable real-time updates for payments and related data
  useLiveDataForPage('payments', {
    relatedCollections: ['students', 'fees']
  });

  const { hasPermission } = useRoleAccess();
  const { user } = useAuth();
  const isParent = user?.role === 'parent';
  const parentId = (user as any)?.parent_id;

  // Permission checks
  const canRead = hasPermission('payment.read');
  const canCreate = hasPermission('payment.create');
  const canUpdate = hasPermission('payment.update');
  const canDelete = hasPermission('payment.delete');
  const canManage = hasPermission('payment.manage');

  // Dialog states
  const [createPaymentOpen, setCreatePaymentOpen] = useState(false);
  const [editPaymentOpen, setEditPaymentOpen] = useState(false);
  const [paymentDetailsOpen, setPaymentDetailsOpen] = useState(false);

  // Current payment for editing/viewing
  const [currentPayment, setCurrentPayment] = useState<Payment | undefined>();

  // Dynamic tabs based on permissions
  const availableTabs = useMemo(() => {
    const tabs = [];

    if (canRead || canManage) {
      // Parents see Dashboard, Payments, and Unpaid Fees (but not Reports)
      if (isParent) {
        tabs.push(
          { value: 'dashboard', label: 'Dashboard', icon: BarChart3 },
          { value: 'payments', label: 'Payments', icon: Receipt },
          { value: 'unpaid', label: 'Unpaid Fees', icon: AlertCircle }
        );
      } else {
        // Non-parents see all tabs including Reports
        tabs.push(
          { value: 'dashboard', label: 'Dashboard', icon: BarChart3 },
          { value: 'payments', label: 'Payments', icon: Receipt },
          { value: 'unpaid', label: 'Unpaid Fees', icon: AlertCircle },
          { value: 'reports', label: 'Reports', icon: TrendingUp }
        );
      }
    }

    if (canManage && !isParent) {
      tabs.push(
        { value: 'bulk-import', label: 'Bulk Import', icon: Upload },
        { value: 'categories', label: 'Categories', icon: Settings }
      );
    }

    return tabs;
  }, [canRead, canManage, isParent]);

  // Active tab - default to first available tab
  const [activeTab, setActiveTab] = useState(availableTabs[0]?.value || 'dashboard');

  const handleCreatePayment = () => {
    setCurrentPayment(undefined);
    setCreatePaymentOpen(true);
  };

  const handleEditPayment = (payment: Payment) => {
    setCurrentPayment(payment);
    setEditPaymentOpen(true);
  };

  const handleViewPaymentDetails = (payment: Payment) => {
    setCurrentPayment(payment);
    setPaymentDetailsOpen(true);
  };

  const handlePaymentSuccess = () => {
    // Refresh data by invalidating queries - this is handled by react-query in individual components
    setCreatePaymentOpen(false);
    setEditPaymentOpen(false);
  };

  const handleViewAllPayments = () => {
    setActiveTab('payments');
  };

  const handleViewReports = () => {
    setActiveTab('reports');
  };

  return (
    <>
      {/* Premium Animation Styles */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes pulseGlow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(37, 99, 235, 0.3);
          }
          50% {
            box-shadow: 0 0 30px rgba(37, 99, 235, 0.5);
          }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
        }

        .animate-slide-in-right {
          animation: slideInRight 0.4s ease-out forwards;
        }

        .animate-pulse-glow:hover {
          animation: pulseGlow 2s ease-in-out infinite;
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        {/* Premium Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-green-600 via-emerald-600 to-green-700 pb-20 pt-16">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-r from-green-600/90 via-emerald-600/90 to-green-700/90" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        {/* Enhanced Floating Shapes with Animation */}
        <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full animate-pulse" />
        <div className="absolute top-20 right-20 w-16 h-16 bg-white/10 rounded-full animate-pulse delay-1000" />
        <div className="absolute bottom-20 left-1/3 w-12 h-12 bg-white/10 rounded-full animate-pulse delay-500" />
        <div className="absolute top-1/2 left-20 w-8 h-8 bg-white/8 rounded-full animate-pulse delay-300" />
        <div className="absolute top-1/3 right-1/4 w-14 h-14 bg-white/8 rounded-full animate-pulse delay-700" />
        <div className="absolute bottom-1/3 right-10 w-10 h-10 bg-white/8 rounded-full animate-pulse delay-900" />
        <div className="absolute top-1/4 left-1/2 w-6 h-6 bg-white/6 rounded-full animate-pulse delay-400" />
        <div className="absolute bottom-10 left-1/4 w-18 h-18 bg-white/8 rounded-full animate-pulse delay-800" />

        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-8 inline-flex items-center rounded-full bg-white/10 backdrop-blur-sm px-6 py-2 text-sm font-medium text-white/90 ring-1 ring-white/20">
              <CreditCard className="mr-2 h-4 w-4" />
              Financial Management System
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
              {isParent ? (
                <>My <span className="bg-gradient-to-r from-green-200 to-emerald-200 bg-clip-text text-transparent">Payments</span></>
              ) : (
                <>Payment <span className="bg-gradient-to-r from-green-200 to-emerald-200 bg-clip-text text-transparent">Management</span></>
              )}
            </h1>
            <p className="mt-6 text-lg leading-8 text-green-100">
              {isParent
                ? "View and manage your children's payment records, track due dates, and access payment history."
                : "Comprehensive payment processing and financial management with advanced analytics. Streamline your financial operations with premium tools."
              }
            </p>
          </div>
        </div>

        {/* Bottom Wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg className="w-full h-20 fill-current text-slate-50" viewBox="0 0 1440 120" preserveAspectRatio="none">
            <path d="M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z" />
          </svg>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 -mt-10 space-y-8 px-6 pb-16">
        {/* Action Bar */}
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
              <p className="text-sm text-gray-600">
                {isParent
                  ? "View your children's payment history and upcoming dues"
                  : "Manage payments efficiently with powerful tools"
                }
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {canCreate && !isParent && (
                <Button
                  onClick={handleCreatePayment}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0 px-6 py-2.5"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Payment
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Premium Tabs */}
        <div className="mx-auto max-w-7xl">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-2 shadow-xl">
              <TabsList className={`grid w-full grid-cols-${availableTabs.length} gap-1 bg-transparent p-1`}>
                {availableTabs.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="flex items-center justify-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-600 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-xl py-3 px-4 transition-all duration-300 hover:bg-gray-100 font-medium"
                  >
                    <tab.icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {(canRead || canManage) && (
              <>
                <TabsContent value="dashboard" className="space-y-6">
                  <PaymentDashboard
                    onCreatePayment={handleCreatePayment}
                    onViewPayments={handleViewAllPayments}
                    onViewReports={handleViewReports}
                  />
                </TabsContent>

                <TabsContent value="payments" className="space-y-6">
                  <PaymentList
                    onEditPayment={handleEditPayment}
                    onViewDetails={handleViewPaymentDetails}
                  />
                </TabsContent>

                <TabsContent value="unpaid" className="space-y-6">
                  <UnpaidQuarterlyFees />
                </TabsContent>

                <TabsContent value="reports" className="space-y-6">
                  <PaymentReports />
                </TabsContent>
              </>
            )}

            {canManage && (
              <>
                <TabsContent value="bulk-import" className="space-y-6">
                  <BulkPaymentImport />
                </TabsContent>

                <TabsContent value="categories" className="space-y-6">
                  <FeeCategoryManagement />
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>
      </div>

      {/* Create Payment Dialog */}
      <Dialog open={createPaymentOpen} onOpenChange={setCreatePaymentOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-glass border border-white/20 shadow-2xl">
          {/* Premium Header */}
          <div className="relative overflow-hidden bg-gradient-to-r from-green-600 via-emerald-600 to-green-700 p-6 -mx-6 -mt-6 mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-green-600/90 via-emerald-600/90 to-green-700/90" />
            <div className="absolute inset-0 opacity-20"
                 style={{
                   backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='10'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                 }} />

            <div className="relative">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-2xl font-bold text-white mb-3">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-full">
                    <Plus className="h-6 w-6" />
                  </div>
                  Create New Payment
                </DialogTitle>
                <DialogDescription className="text-green-100 text-lg">
                  Create a comprehensive payment record with multiple fee categories and detailed information
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          {/* Premium Form Container */}
          <div className="bg-white/80 backdrop-blur-sm border border-white/30 shadow-xl rounded-2xl p-6 mt-6">
            <PaymentForm
              onSuccess={handlePaymentSuccess}
              onCancel={() => setCreatePaymentOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Dialog */}
      <Dialog open={editPaymentOpen} onOpenChange={setEditPaymentOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-glass border border-white/20 shadow-2xl">
          {/* Premium Header */}
          <div className="relative overflow-hidden bg-gradient-to-r from-green-600 via-emerald-600 to-green-700 p-6 -mx-6 -mt-6 mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-green-600/90 via-emerald-600/90 to-green-700/90" />
            <div className="absolute inset-0 opacity-20"
                 style={{
                   backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='10'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                 }} />

            <div className="relative">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-2xl font-bold text-white mb-3">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-full">
                    <FileText className="h-6 w-6" />
                  </div>
                  Edit Payment Record
                </DialogTitle>
                <DialogDescription className="text-green-100 text-lg">
                  Update payment details and information with comprehensive editing tools
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          {/* Premium Form Container */}
          <div className="bg-white/80 backdrop-blur-sm border border-white/30 shadow-xl rounded-2xl p-6 mt-6">
            <PaymentForm
              payment={currentPayment}
              onSuccess={handlePaymentSuccess}
              onCancel={() => setEditPaymentOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Details Dialog */}
      <Dialog open={paymentDetailsOpen} onOpenChange={setPaymentDetailsOpen}>
        <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-glass border border-white/20 shadow-2xl">
          {/* Premium Header */}
          <div className="relative overflow-hidden bg-gradient-to-r from-green-600 via-emerald-600 to-green-700 p-6 -mx-6 -mt-6 mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-green-600/90 via-emerald-600/90 to-green-700/90" />
            <div className="absolute inset-0 opacity-20"
                 style={{
                   backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='10'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                 }} />

            <div className="relative">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-2xl font-bold text-white mb-3">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-full">
                    <Receipt className="h-6 w-6" />
                  </div>
                  Payment Details
                </DialogTitle>
                <DialogDescription className="text-green-100 text-lg">
                  {currentPayment ? `Receipt #${currentPayment.receipt_number}` : 'Comprehensive payment information'}
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm border border-white/30 shadow-xl rounded-2xl p-6">
            {currentPayment && (
              <div className="space-y-6">
              {/* Payment Overview */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Amount</p>
                  <p className="text-2xl font-bold">${(() => {
                    const amt = Number((currentPayment as any).amount ?? 0);
                    return amt.toFixed(2);
                  })()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <div className="capitalize">{currentPayment.status}</div>
                </div>
              </div>

              {/* Student Information */}
              {currentPayment.student && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Student Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Name: </span>
                      {(() => {
                        const s: any = currentPayment.student;
                        const parts = [s?.first_name, s?.last_name || s?.father_name, s?.grandfather_name].filter(Boolean);
                        return parts.length ? parts.join(' ') : (s?.student_id || 'Unknown');
                      })()}
                    </div>
                    <div>
                      <span className="font-medium">Student ID: </span>
                      {currentPayment.student.student_id}
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Details */}
              <div className="space-y-2">
                <h4 className="font-semibold">Payment Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Fee Category: </span>
                    {currentPayment.fee_category?.name || 'Unknown'}
                  </div>
                  <div>
                    <span className="font-medium">Payment Method: </span>
                    {currentPayment.payment_method.replace('_', ' ').toUpperCase()}
                  </div>
                  <div>
                    <span className="font-medium">Payment Date: </span>
                    {new Date(currentPayment.payment_date).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium">Due Date: </span>
                    {new Date(currentPayment.due_date).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {currentPayment.notes && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Notes</h4>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                    {currentPayment.notes}
                  </p>
                </div>
              )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
}
