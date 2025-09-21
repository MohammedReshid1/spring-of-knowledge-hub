import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Upload, FileText, Settings, BarChart3, CreditCard, DollarSign, TrendingUp, Receipt } from 'lucide-react';
import { PaymentDashboard } from '@/components/payments/PaymentDashboard';
import { PaymentForm } from '@/components/payments/PaymentForm';
import { PaymentList } from '@/components/payments/PaymentList';
import { BulkImportModal } from '@/components/payments/BulkImportModal';
import { PaymentReports } from '@/components/payments/PaymentReports';
import { FeeCategoryManagement } from '@/components/payments/FeeCategoryManagement';
import type { Payment } from '@/types/api';

export default function PaymentsPage() {
  // Dialog states
  const [createPaymentOpen, setCreatePaymentOpen] = useState(false);
  const [editPaymentOpen, setEditPaymentOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [paymentDetailsOpen, setPaymentDetailsOpen] = useState(false);

  // Current payment for editing/viewing
  const [currentPayment, setCurrentPayment] = useState<Payment | undefined>();

  // Active tab
  const [activeTab, setActiveTab] = useState('dashboard');

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

  const handleBulkImportSuccess = () => {
    setBulkImportOpen(false);
    // Switch to payments list to see imported data
    setActiveTab('payments');
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
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 pb-20 pt-16">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/90 via-blue-700/90 to-indigo-800/90" />
        <div className="absolute inset-0 opacity-20"
             style={{
               backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='10'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
             }} />

        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-8 inline-flex items-center rounded-full bg-white/10 backdrop-blur-sm px-6 py-2 text-sm font-medium text-white/90 ring-1 ring-white/20">
              <CreditCard className="mr-2 h-4 w-4" />
              Financial Management System
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
              Payment <span className="bg-gradient-to-r from-blue-200 to-cyan-200 bg-clip-text text-transparent">Management</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-blue-100">
              Comprehensive payment processing and financial management with advanced analytics.
              Streamline your financial operations with premium tools.
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
              <p className="text-sm text-gray-600">Manage payments efficiently with powerful tools</p>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={() => setBulkImportOpen(true)}
                className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white border-0 hover:from-indigo-600 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <Upload className="h-4 w-4 mr-2" />
                Bulk Import
              </Button>
              <Button
                onClick={handleCreatePayment}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0 px-6 py-2.5"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Payment
              </Button>
            </div>
          </div>
        </div>

        {/* Premium Tabs */}
        <div className="mx-auto max-w-7xl">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-2 shadow-xl">
              <TabsList className="grid w-full grid-cols-4 gap-1 bg-transparent p-1">
                <TabsTrigger
                  value="dashboard"
                  className="flex items-center justify-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-xl py-3 px-4 transition-all duration-300 hover:bg-gray-100 font-medium"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Dashboard</span>
                </TabsTrigger>
                <TabsTrigger
                  value="payments"
                  className="flex items-center justify-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-xl py-3 px-4 transition-all duration-300 hover:bg-gray-100 font-medium"
                >
                  <Receipt className="h-4 w-4" />
                  <span>Payments</span>
                </TabsTrigger>
                <TabsTrigger
                  value="categories"
                  className="flex items-center justify-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-xl py-3 px-4 transition-all duration-300 hover:bg-gray-100 font-medium"
                >
                  <Settings className="h-4 w-4" />
                  <span>Categories</span>
                </TabsTrigger>
                <TabsTrigger
                  value="reports"
                  className="flex items-center justify-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-xl py-3 px-4 transition-all duration-300 hover:bg-gray-100 font-medium"
                >
                  <TrendingUp className="h-4 w-4" />
                  <span>Reports</span>
                </TabsTrigger>
              </TabsList>
            </div>

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

            <TabsContent value="categories" className="space-y-6">
              <FeeCategoryManagement />
            </TabsContent>

            <TabsContent value="reports" className="space-y-6">
              <PaymentReports />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Create Payment Dialog */}
      <Dialog open={createPaymentOpen} onOpenChange={setCreatePaymentOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-glass border border-white/20 shadow-2xl">
          {/* Premium Header */}
          <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 p-6 -mx-6 -mt-6 mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/90 via-blue-700/90 to-indigo-800/90" />
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
                <DialogDescription className="text-blue-100 text-lg">
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
          <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 p-6 -mx-6 -mt-6 mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/90 via-blue-700/90 to-indigo-800/90" />
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
                <DialogDescription className="text-blue-100 text-lg">
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

      {/* Bulk Import Modal */}
      <BulkImportModal
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onSuccess={handleBulkImportSuccess}
      />

      {/* Payment Details Dialog */}
      <Dialog open={paymentDetailsOpen} onOpenChange={setPaymentDetailsOpen}>
        <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-glass border border-white/20 shadow-2xl">
          {/* Premium Header */}
          <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 p-6 -mx-6 -mt-6 mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/90 via-blue-700/90 to-indigo-800/90" />
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
                <DialogDescription className="text-blue-100 text-lg">
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
