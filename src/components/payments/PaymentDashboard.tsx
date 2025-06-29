import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Calendar, 
  CreditCard, 
  AlertCircle,
  CheckCircle,
  Clock,
  PieChart,
  FileText
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const PaymentDashboard = () => {
  const { data: paymentStats } = useQuery({
    queryKey: ['payment-dashboard-stats'],
    queryFn: async () => {
      console.log('Fetching payment dashboard stats...');
      
      // Get all payments with student info
      const { data: payments, error: paymentsError } = await supabase
        .from('registration_payments')
        .select(`
          *,
          students:student_id (
            id,
            first_name,
            last_name,
            grade_level,
            status
          )
        `);

      if (paymentsError) throw paymentsError;

      // Get all active students for comparison
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, status')
        .eq('status', 'Active');

      if (studentsError) throw studentsError;

      // Calculate statistics
      const totalRevenue = payments?.reduce((sum, p) => sum + (p.amount_paid || 0), 0) || 0;
      const totalPayments = payments?.length || 0;
      const activeStudents = students?.length || 0;
      
      // Payment status breakdown
      const statusBreakdown = payments?.reduce((acc, payment) => {
        const status = payment.payment_status || 'Unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Monthly revenue (last 6 months)
      const monthlyRevenue = payments?.reduce((acc, payment) => {
        if (!payment.payment_date) return acc;
        
        const date = new Date(payment.payment_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!acc[monthKey]) {
          acc[monthKey] = { amount: 0, count: 0 };
        }
        
        acc[monthKey].amount += payment.amount_paid || 0;
        acc[monthKey].count += 1;
        
        return acc;
      }, {} as Record<string, { amount: number; count: number }>) || {};

      // Grade level payment analysis
      const gradePayments = payments?.reduce((acc, payment) => {
        const grade = payment.students?.grade_level || 'Unknown';
        if (!acc[grade]) {
          acc[grade] = { amount: 0, count: 0, students: new Set() };
        }
        acc[grade].amount += payment.amount_paid || 0;
        acc[grade].count += 1;
        if (payment.students?.id) {
          acc[grade].students.add(payment.students.id);
        }
        return acc;
      }, {} as Record<string, { amount: number; count: number; students: Set<string> }>) || {};

      // Convert sets to counts
      const gradeStats = Object.entries(gradePayments).map(([grade, stats]) => ({
        grade,
        amount: stats.amount,
        paymentCount: stats.count,
        studentCount: stats.students.size
      }));

      // Recent payments (last 10)
      const recentPayments = payments
        ?.sort((a, b) => new Date(b.payment_date || '').getTime() - new Date(a.payment_date || '').getTime())
        ?.slice(0, 10) || [];

      // Students with payment issues
      const studentsWithIssues = payments?.filter(p => 
        p.payment_status === 'Unpaid' || p.payment_status === 'Partially Paid'
      ).length || 0;

      // Payment completion rate
      const paidPayments = payments?.filter(p => p.payment_status === 'Paid').length || 0;
      const completionRate = totalPayments > 0 ? (paidPayments / totalPayments) * 100 : 0;

      console.log('Payment dashboard stats calculated successfully');
      return {
        totalRevenue,
        totalPayments,
        activeStudents,
        statusBreakdown,
        monthlyRevenue,
        gradeStats,
        recentPayments,
        studentsWithIssues,
        completionRate,
        paidPayments,
        allPayments: payments || []
      };
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const generateReport = () => {
    if (!paymentStats) {
      toast({
        title: "Error",
        description: "No data available to generate report",
        variant: "destructive",
      });
      return;
    }

    const doc = new jsPDF();
    
    // Add title and header
    doc.setFontSize(20);
    doc.text('Payment Dashboard Report', 14, 22);
    
    doc.setFontSize(12);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 32);
    doc.text(`Report Period: All Time`, 14, 40);
    
    // Summary statistics
    doc.setFontSize(16);
    doc.text('Summary Statistics', 14, 55);
    
    doc.setFontSize(12);
    doc.text(`Total Revenue: $${paymentStats.totalRevenue.toFixed(2)}`, 14, 65);
    doc.text(`Total Payments: ${paymentStats.totalPayments}`, 14, 73);
    doc.text(`Active Students: ${paymentStats.activeStudents}`, 14, 81);
    doc.text(`Payment Completion Rate: ${Math.round(paymentStats.completionRate)}%`, 14, 89);
    doc.text(`Students with Payment Issues: ${paymentStats.studentsWithIssues}`, 14, 97);
    
    // Payment status breakdown table
    doc.setFontSize(16);
    doc.text('Payment Status Breakdown', 14, 115);
    
    const statusData = Object.entries(paymentStats.statusBreakdown).map(([status, count]) => [
      status,
      count.toString(),
      `${((count / paymentStats.totalPayments) * 100).toFixed(1)}%`
    ]);
    
    doc.autoTable({
      head: [['Status', 'Count', 'Percentage']],
      body: statusData,
      startY: 125,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [66, 139, 202] }
    });
    
    // Grade level analysis
    const finalY = doc.lastAutoTable.finalY || 125;
    doc.setFontSize(16);
    doc.text('Grade Level Revenue Analysis', 14, finalY + 20);
    
    const gradeData = paymentStats.gradeStats
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
      .map(grade => [
        grade.grade.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        `$${grade.amount.toFixed(2)}`,
        grade.studentCount.toString(),
        grade.paymentCount.toString()
      ]);
    
    doc.autoTable({
      head: [['Grade Level', 'Total Revenue', 'Students', 'Payments']],
      body: gradeData,
      startY: finalY + 30,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [66, 139, 202] }
    });
    
    // Recent payments
    const finalY2 = doc.lastAutoTable.finalY || finalY + 30;
    doc.setFontSize(16);
    doc.text('Recent Payments (Last 10)', 14, finalY2 + 20);
    
    const recentData = paymentStats.recentPayments.slice(0, 10).map(payment => [
      payment.students ? `${payment.students.first_name} ${payment.students.last_name}` : 'Unknown',
      `$${(payment.amount_paid || 0).toFixed(2)}`,
      payment.payment_status || 'Unknown',
      payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : 'No date'
    ]);
    
    doc.autoTable({
      head: [['Student', 'Amount', 'Status', 'Date']],
      body: recentData,
      startY: finalY2 + 30,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [66, 139, 202] }
    });
    
    // Save the PDF
    doc.save(`payment_dashboard_report_${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({
      title: "Success",
      description: "Payment dashboard report generated successfully",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatGradeLevel = (grade: string) => {
    return grade.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getStatusColor = (status: string) => {
    const colors = {
      'Paid': 'bg-green-100 text-green-800',
      'Unpaid': 'bg-red-100 text-red-800',
      'Partially Paid': 'bg-yellow-100 text-yellow-800',
      'Waived': 'bg-blue-100 text-blue-800',
      'Refunded': 'bg-purple-100 text-purple-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (!paymentStats) {
    return (
      <div className="space-y-6 p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-6"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Payment Dashboard</h2>
          <p className="text-gray-600 mt-1">
            Overview of payment activities and financial metrics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={generateReport}>
            <FileText className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
          <Link to="/payments">
            <Button variant="outline">
              <CreditCard className="h-4 w-4 mr-2" />
              Manage Payments
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">
              {formatCurrency(paymentStats.totalRevenue)}
            </div>
            <p className="text-xs text-green-600 mt-1">
              From {paymentStats.totalPayments} payments
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Payment Completion</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">
              {Math.round(paymentStats.completionRate)}%
            </div>
            <p className="text-xs text-blue-600 mt-1">
              {paymentStats.paidPayments} of {paymentStats.totalPayments} paid
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700">Active Students</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900">{paymentStats.activeStudents}</div>
            <p className="text-xs text-purple-600 mt-1">
              Currently enrolled
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700">Payment Issues</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900">{paymentStats.studentsWithIssues}</div>
            <p className="text-xs text-orange-600 mt-1">
              Unpaid or partial payments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Statistics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Payment Status Breakdown */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChart className="h-5 w-5 text-blue-600" />
              Payment Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(paymentStats.statusBreakdown).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(status)} variant="outline">
                    {status}
                  </Badge>
                </div>
                <span className="font-medium">{count}</span>
              </div>
            ))}
            <div className="pt-2">
              <Progress 
                value={paymentStats.completionRate} 
                className="h-2"
              />
              <p className="text-xs text-gray-600 mt-1">
                {Math.round(paymentStats.completionRate)}% completion rate
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Grade Level Analysis */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Grade Level Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {paymentStats.gradeStats
              .sort((a, b) => b.amount - a.amount)
              .slice(0, 5)
              .map((grade) => (
                <div key={grade.grade} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{formatGradeLevel(grade.grade)}</span>
                    <span className="text-gray-600">{formatCurrency(grade.amount)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{grade.studentCount} students</span>
                    <span>{grade.paymentCount} payments</span>
                  </div>
                  <Progress 
                    value={(grade.amount / paymentStats.totalRevenue) * 100} 
                    className="h-1"
                  />
                </div>
              ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-600" />
              Recent Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paymentStats.recentPayments.length > 0 ? (
              <div className="space-y-3">
                {paymentStats.recentPayments.slice(0, 5).map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {payment.students 
                          ? `${payment.students.first_name} ${payment.students.last_name}`
                          : 'Unknown Student'
                        }
                      </p>
                      <p className="text-xs text-gray-500">
                        {payment.payment_date 
                          ? new Date(payment.payment_date).toLocaleDateString()
                          : 'No date'
                        }
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-600">
                        {formatCurrency(payment.amount_paid || 0)}
                      </p>
                      <Badge className={getStatusColor(payment.payment_status || '')} variant="outline">
                        {payment.payment_status}
                      </Badge>
                    </div>
                  </div>
                ))}
                <Link to="/payments">
                  <Button variant="outline" className="w-full mt-3">
                    View All Payments
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600 font-medium">No recent payments</p>
                <p className="text-xs text-gray-500">Payment activity will appear here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Link to="/payments">
              <Button variant="outline" className="w-full justify-start hover:bg-blue-50">
                <CreditCard className="h-4 w-4 mr-2" />
                Record New Payment
              </Button>
            </Link>
            <Link to="/students">
              <Button variant="outline" className="w-full justify-start hover:bg-green-50">
                <Users className="h-4 w-4 mr-2" />
                View Students
              </Button>
            </Link>
            <Button 
              variant="outline" 
              className="w-full justify-start hover:bg-purple-50"
              onClick={generateReport}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};