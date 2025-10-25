import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useBranch } from '@/contexts/BranchContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import {
  Calendar,
  Users,
  TrendingUp,
  TrendingDown,
  Clock,
  UserCheck,
  UserX,
  Award,
  AlertTriangle,
  Download,
  FileText,
  FileSpreadsheet,
  User
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AttendanceSummary {
  total_students: number;
  average_attendance_rate: number;
  total_absences: number;
  total_late_arrivals: number;
  perfect_attendance: Array<{
    student_id: string;
    student_name: string;
  }>;
  concerning_attendance: Array<{
    student_id: string;
    student_name: string;
    attendance_rate: number;
  }>;
  class_attendance_rates: Record<string, number>;
  best_performing_class: string;
  daily_trends: Record<string, number>;
}

type ReportType = 'summary' | 'student' | 'class' | 'monthly' | 'concerns' | 'daily_trends' | 'comprehensive';

export const AttendanceReports: React.FC = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [reportType, setReportType] = useState<ReportType>('summary');
  const [isExporting, setIsExporting] = useState(false);
  const { selectedBranch } = useBranch();
  const { user } = useAuth();

  const userRole = user?.role;
  const userId = user?.id;

  // Helper function to convert data to CSV format
  const convertToCSV = (data: any[]): string => {
    if (!data || data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');

    const csvRows = data.map((row) => {
      return headers.map((header) => {
        const rawValue = row[header];
        if (rawValue === null || rawValue === undefined) {
          return '';
        }
        if (typeof rawValue === 'string') {
          return rawValue.includes(',') ? `"${rawValue}"` : rawValue;
        }
        return String(rawValue);
      }).join(',');
    });

    return [csvHeaders, ...csvRows].join('\n');
  };

  // Helper function to download CSV file
  const downloadCSV = (csvContent: string, filename: string): void => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // PDF Generation Functions
  const generatePDFHeader = (doc: jsPDF, title: string, subtitle?: string) => {
    // Add school header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Spring of Knowledge', 14, 15);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Attendance Management System', 14, 22);

    // Add report title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, 35);

    if (subtitle) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(subtitle, 14, 42);
    }

    // Add date generated
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 48);

    // Add separator line
    doc.setLineWidth(0.5);
    doc.line(14, 52, 196, 52);

    return 58; // Return Y position for content to start
  };

  const generateSingleStudentPDF = async (studentId: string) => {
    const doc = new jsPDF();
    let yPos = generatePDFHeader(doc, 'Individual Student Attendance Report', `Student ID: ${studentId}`);

    // Fetch student attendance data
    const periodStart = dateRange?.from?.toISOString().split('T')[0];
    const periodEnd = dateRange?.to?.toISOString().split('T')[0];
    const { data: studentData } = await apiClient.getAttendanceSummary(
      studentId,
      periodStart,
      periodEnd
    );

    if (studentData) {
      // Student info section
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Student Information', 14, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Attendance Period: ${dateRange?.from?.toLocaleDateString()} - ${dateRange?.to?.toLocaleDateString()}`, 14, yPos);
      yPos += 6;
      doc.text(`Total Days: ${studentData.total_days || 0}`, 14, yPos);
      yPos += 6;
      doc.text(`Days Present: ${studentData.days_present || 0}`, 14, yPos);
      yPos += 6;
      doc.text(`Days Absent: ${studentData.days_absent || 0}`, 14, yPos);
      yPos += 6;
      doc.text(`Days Late: ${studentData.days_late || 0}`, 14, yPos);
      yPos += 10;

      // Attendance metrics
      doc.setFont('helvetica', 'bold');
      doc.text('Attendance Metrics', 14, yPos);
      yPos += 8;

      doc.setFont('helvetica', 'normal');
      doc.text(`Attendance Rate: ${studentData.attendance_percentage?.toFixed(2) || 0}%`, 14, yPos);
      yPos += 6;
      doc.text(`Punctuality Rate: ${studentData.punctuality_percentage?.toFixed(2) || 0}%`, 14, yPos);
      yPos += 6;
      doc.text(`Current Streak: ${studentData.current_streak || 0} days`, 14, yPos);
      yPos += 6;
      doc.text(`Longest Streak: ${studentData.longest_streak || 0} days`, 14, yPos);
      yPos += 10;

      // Patterns detected
      if (studentData.patterns_detected && studentData.patterns_detected.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('Patterns Detected:', 14, yPos);
        yPos += 6;

        doc.setFont('helvetica', 'normal');
        studentData.patterns_detected.forEach((pattern: string) => {
          doc.text(`• ${pattern.replace(/_/g, ' ')}`, 20, yPos);
          yPos += 5;
        });
      }
    }

    doc.save(`student_attendance_${studentId}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const generateClassAttendancePDF = async (classId: string) => {
    const doc = new jsPDF();
    const className = classes.find((c: any) => c.id === classId)?.class_name || classes.find((c: any) => c.id === classId)?.name || 'Unknown Class';
    let yPos = generatePDFHeader(doc, 'Class Attendance Report', `Class: ${className}`);

    // Summary section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Class Summary', 14, yPos);
    yPos += 8;

    if (attendanceSummary?.class_attendance_rates?.[classId]) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Average Attendance Rate: ${attendanceSummary.class_attendance_rates[classId].toFixed(2)}%`, 14, yPos);
      yPos += 6;
      doc.text(`Period: ${dateRange?.from?.toLocaleDateString()} - ${dateRange?.to?.toLocaleDateString()}`, 14, yPos);
      yPos += 10;
    }

    // Fetch class attendance details
    const { data: classAttendance } = await apiClient.getAttendance({
      class_id: classId,
      start_date: dateRange?.from?.toISOString().split('T')[0],
      end_date: dateRange?.to?.toISOString().split('T')[0]
    });

    if (classAttendance && classAttendance.length > 0) {
      // Group by student
      const studentMap = new Map();
      classAttendance.forEach((record: any) => {
        if (!studentMap.has(record.student_id)) {
          studentMap.set(record.student_id, {
            present: 0,
            absent: 0,
            late: 0,
            total: 0
          });
        }
        const stats = studentMap.get(record.student_id);
        stats.total++;
        if (record.status === 'present') stats.present++;
        if (record.status === 'absent') stats.absent++;
        if (record.status === 'late' || record.status === 'tardy') stats.late++;
      });

      // Create table data with student names
      const tableData = Array.from(studentMap.entries()).map(([studentId, stats]: [string, any]) => {
        // Find student name from students array
        const student = students.find((s: any) => s.id === studentId || s.student_id === studentId);
        const studentName = student ? [
          student.first_name,
          student.father_name,
          student.grandfather_name
        ].filter(Boolean).join(' ').trim() || student.full_name || `Student ${studentId}` : `Student ${studentId}`;

        return [
          studentName,
          stats.total,
          stats.present,
          stats.absent,
          stats.late,
          `${((stats.present / stats.total) * 100).toFixed(2)}%`
        ];
      });

      autoTable(doc, {
        startY: yPos,
        head: [['Student Name', 'Total Days', 'Present', 'Absent', 'Late', 'Attendance %']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        styles: { fontSize: 9 }
      });
    }

    doc.save(`class_attendance_${classId}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const generateMonthlyAttendancePDF = () => {
    const doc = new jsPDF();
    let yPos = generatePDFHeader(doc, 'Monthly Attendance Report',
      `Period: ${dateRange?.from?.toLocaleDateString()} - ${dateRange?.to?.toLocaleDateString()}`);

    if (!attendanceSummary) return;

    
    // Overall statistics
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Overall Statistics', 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Average Attendance Rate: ${attendanceSummary.average_attendance_rate.toFixed(2)}%`, 14, yPos);
    yPos += 6;
    doc.text(`Total Students: ${attendanceSummary.total_students}`, 14, yPos);
    yPos += 6;
    doc.text(`Total Absences: ${attendanceSummary.total_absences}`, 14, yPos);
    yPos += 6;
    doc.text(`Late Arrivals: ${attendanceSummary.total_late_arrivals}`, 14, yPos);
    yPos += 12;

    // Daily trends
    if (attendanceSummary.daily_trends) {
      doc.setFont('helvetica', 'bold');
      doc.text('Daily Attendance Patterns', 14, yPos);
      yPos += 8;

      const dailyData = Object.entries(attendanceSummary.daily_trends).map(([day, rate]) => [
        day,
        `${rate.toFixed(2)}%`
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Day of Week', 'Attendance Rate']],
        body: dailyData,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 10 }
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // Class performance section removed - class attendance rates field is consistently empty

    doc.save(`monthly_attendance_report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const generateConcernsPDF = () => {
    const doc = new jsPDF();
    let yPos = generatePDFHeader(doc, 'Attendance Concerns Report',
      'Students requiring intervention');

    if (!attendanceSummary || !attendanceSummary.concerning_attendance) return;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Students with Concerns: ${attendanceSummary.concerning_attendance.length}`, 14, yPos);
    doc.text(`Reporting Period: ${dateRange?.from?.toLocaleDateString()} - ${dateRange?.to?.toLocaleDateString()}`, 14, yPos + 6);
    yPos += 16;

    if (attendanceSummary.concerning_attendance.length > 0) {
      const concernData = attendanceSummary.concerning_attendance.map((student) => {
        let level = 'Moderate';
        if (student.attendance_rate < 60) level = 'Critical';
        else if (student.attendance_rate < 70) level = 'High';

        return [
          student.student_name || `Student ${student.student_id}`,
          `${student.attendance_rate.toFixed(2)}%`,
          level,
          level === 'Critical' ? 'Immediate intervention required' :
          level === 'High' ? 'Requires monitoring' : 'Follow-up recommended'
        ];
      });

      autoTable(doc, {
        startY: yPos,
        head: [['Student Name', 'Attendance Rate', 'Concern Level', 'Recommended Action']],
        body: concernData,
        theme: 'grid',
        headStyles: { fillColor: [239, 68, 68] },
        styles: { fontSize: 9 },
        columnStyles: {
          2: { halign: 'center', fontStyle: 'bold' }
        }
      });
    } else {
      doc.text('No attendance concerns identified for this period.', 14, yPos);
    }

    doc.save(`attendance_concerns_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const generateComprehensivePDF = () => {
    const doc = new jsPDF();
    let yPos = generatePDFHeader(doc, 'Comprehensive Attendance Report',
      'Complete attendance analysis and insights');

    if (!attendanceSummary) return;

    // Executive Summary
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Executive Summary', 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const summaryText = [
      `Reporting Period: ${dateRange?.from?.toLocaleDateString()} - ${dateRange?.to?.toLocaleDateString()}`,
      `Total Students Tracked: ${attendanceSummary.total_students}`,
      `Average Attendance Rate: ${attendanceSummary.average_attendance_rate.toFixed(2)}%`,
      `Total Absences: ${attendanceSummary.total_absences}`,
      `Late Arrivals: ${attendanceSummary.total_late_arrivals}`,
      `Perfect Attendance: ${attendanceSummary.perfect_attendance?.length || 0} students`,
      `Students Requiring Attention: ${attendanceSummary.concerning_attendance?.length || 0}`
    ];

    summaryText.forEach(text => {
      doc.text(text, 14, yPos);
      yPos += 5;
    });
    yPos += 5;

    // Add new page for detailed sections
    doc.addPage();
    yPos = 20;

    // Class Performance Section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Class Performance Analysis', 14, yPos);
    yPos += 8;

    if (attendanceSummary.class_attendance_rates) {
      const classData = Object.entries(attendanceSummary.class_attendance_rates)
        .sort(([,a], [,b]) => b - a)
        .map(([classId, rate]) => {
          const className = classes.find((c: any) => c.id === classId)?.class_name || classes.find((c: any) => c.id === classId)?.name || classId;
          return [className, `${rate.toFixed(2)}%`];
        });

      autoTable(doc, {
        startY: yPos,
        head: [['Class', 'Attendance Rate']],
        body: classData,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] }
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // Daily Patterns
    if (attendanceSummary.daily_trends) {
      doc.setFont('helvetica', 'bold');
      doc.text('Daily Attendance Patterns', 14, yPos);
      yPos += 8;

      const dailyData = Object.entries(attendanceSummary.daily_trends).map(([day, rate]) => [
        day,
        `${rate.toFixed(2)}%`
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Day', 'Rate']],
        body: dailyData,
        theme: 'striped'
      });
    }

    doc.save(`comprehensive_attendance_report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Main export handler
  const handleExportPDF = async (type: ReportType) => {
    setIsExporting(true);
    try {
      switch (type) {
        case 'student':
          if (selectedStudent) {
            // Find the student object to get the actual student_id
            const student = students.find((s: any) => s.id === selectedStudent);
            if (student) {
              await generateSingleStudentPDF(student.student_id || selectedStudent);
            }
          }
          break;
        case 'class':
          if (selectedClass && selectedClass !== 'all') {
            await generateClassAttendancePDF(selectedClass);
          }
          break;
        case 'monthly':
          generateMonthlyAttendancePDF();
          break;
        case 'concerns':
          generateConcernsPDF();
          break;
        case 'comprehensive':
          generateComprehensivePDF();
          break;
        case 'summary':
        default:
          // Export summary as CSV
          handleExportReport();
          break;
      }
    } catch (error) {
      console.error('Failed to generate PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // CSV Export (existing functionality)
  const handleExportReport = async () => {
    if (!attendanceSummary) return;

    setIsExporting(true);
    try {
      const reportData = [
        {
          report_date: new Date().toISOString().split('T')[0],
          date_range_start: dateRange?.from?.toISOString().split('T')[0] || 'N/A',
          date_range_end: dateRange?.to?.toISOString().split('T')[0] || 'N/A',
          average_attendance_rate: attendanceSummary.average_attendance_rate?.toFixed(2) || '0.00',
          total_students: attendanceSummary.total_students || 0,
          total_absences: attendanceSummary.total_absences || 0,
          total_late_arrivals: attendanceSummary.total_late_arrivals || 0,
          perfect_attendance_count: attendanceSummary.perfect_attendance?.length || 0,
          concerning_students_count: attendanceSummary.concerning_attendance?.length || 0,
          best_performing_class: attendanceSummary.best_performing_class || 'N/A',
        }
      ];

      const csv = convertToCSV(reportData);
      const filename = `attendance_report_${new Date().toISOString().split('T')[0]}.csv`;
      downloadCSV(csv, filename);
    } catch (error) {
      console.error('Failed to export report:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const { data: attendanceSummary, isLoading } = useQuery<AttendanceSummary>({
    queryKey: ['attendance-summary-v2', dateRange, selectedClass, selectedBranch?.id],
    queryFn: async () => {
      const params = {
        ...(dateRange?.from && { start_date: dateRange.from.toISOString().split('T')[0] }),
        ...(dateRange?.to && { end_date: dateRange.to.toISOString().split('T')[0] }),
        ...(selectedClass && selectedClass !== 'all' && { class_id: selectedClass }),
        branch_id: selectedBranch?.id
      };

      const { data } = await apiClient.getAttendanceReportSummary(params);
      return data;
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: userRole === 'teacher' ? ['teacher-classes-reports', userId] : ['classes-list'],
    queryFn: async () => {
      if (userRole === 'teacher' && userId) {
        // For teachers, fetch only their assigned classes
        const { data, error } = await apiClient.getTeacherEnhancedClasses(userId);
        if (error) throw error;
        // Extract classes from the response
        return data?.classes || [];
      } else {
        // For non-teachers, fetch all classes
        const response = await apiClient.get('/classes');
        // Ensure we return an array
        return Array.isArray(response.data) ? response.data : [];
      }
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students-list', selectedClass],
    queryFn: async () => {
      const response = await apiClient.get('/students', {
        params: {
          ...(selectedClass && selectedClass !== 'all' ? { class_id: selectedClass } : {}),
          limit: 1000 // Fetch all students for dropdown
        }
      });
      // Handle nested items structure and ensure we return an array
      if (response.data && Array.isArray(response.data.items)) {
        return response.data.items;
      }
      return Array.isArray(response.data) ? response.data : [];
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading attendance reports...</div>;
  }

  if (!attendanceSummary) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Attendance Reports</h2>
            <p className="text-muted-foreground">Generate and export attendance reports</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Class (Optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((cls: any) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.class_name || cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DatePickerWithRange
            date={dateRange}
            onDateChange={setDateRange}
            placeholder="Report Period"
          />
        </div>

        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">No attendance data available. Please select a date range to generate reports.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getAttendanceColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600';
    if (rate >= 90) return 'text-blue-600';
    if (rate >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAttendanceBadge = (rate: number) => {
    if (rate >= 95) return 'bg-green-100 text-green-800';
    if (rate >= 90) return 'bg-blue-100 text-blue-800';
    if (rate >= 85) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Attendance Reports</h2>
          <p className="text-muted-foreground">Generate and export attendance reports</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Class (Optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classes.map((cls: any) => (
              <SelectItem key={cls.id} value={cls.id}>
                {cls.class_name || cls.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DatePickerWithRange
          date={dateRange}
          onDateChange={setDateRange}
          placeholder="Report Period"
        />
      </div>

      {/* Summary Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Summary Overview</CardTitle>
          <p className="text-sm text-muted-foreground">
            Reporting window: {dateRange?.from?.toLocaleDateString() || 'Start'} - {dateRange?.to?.toLocaleDateString() || 'End'}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
              <div className="text-sm text-blue-800 mb-1">Average Attendance</div>
              <div className={`text-3xl font-bold ${getAttendanceColor(attendanceSummary.average_attendance_rate)}`}>
                {attendanceSummary.average_attendance_rate.toFixed(1)}%
              </div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
              <div className="text-sm text-green-800 mb-1">Total Students</div>
              <div className="text-3xl font-bold text-green-600">
                {attendanceSummary.total_students}
              </div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-lg">
              <div className="text-sm text-red-800 mb-1">Absences Recorded</div>
              <div className="text-3xl font-bold text-red-600">
                {attendanceSummary.total_absences}
              </div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg">
              <div className="text-sm text-orange-800 mb-1">Late Arrivals</div>
              <div className="text-3xl font-bold text-orange-600">
                {attendanceSummary.total_late_arrivals}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

  
      {/* Daily Attendance Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Attendance Trends</CardTitle>
          <p className="text-sm text-muted-foreground">Average attendance by day of the week</p>
        </CardHeader>
        <CardContent>
          {attendanceSummary.daily_trends && Object.keys(attendanceSummary.daily_trends).length > 0 ? (
            <div className="grid gap-3 md:grid-cols-5">
              {Object.entries(attendanceSummary.daily_trends).map(([day, rate]) => (
                <div key={day} className="p-4 border rounded-lg bg-gradient-to-br from-gray-50 to-gray-100">
                  <div className="text-center">
                    <div className="font-medium mb-2">{day}</div>
                    <div className={`text-2xl font-bold ${getAttendanceColor(rate)}`}>
                      {rate.toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              No daily trend data available.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Highlights */}
      <Card>
        <CardHeader>
          <CardTitle>Highlights</CardTitle>
          <p className="text-sm text-muted-foreground">Key insights for follow-up</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-red-800">Students Below 75%</span>
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div className="text-2xl font-bold text-red-600">
                {attendanceSummary.concerning_attendance?.filter(s => s.attendance_rate < 75).length || 0}
              </div>
            </div>

            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-green-800">Perfect Attendance</span>
                <Award className="h-5 w-5 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-600">
                {attendanceSummary.perfect_attendance?.length || 0}
              </div>
            </div>

                      </div>
        </CardContent>
      </Card>

  
      {/* Export Reports Section */}
      <Card>
        <CardHeader>
          <CardTitle>Export Reports</CardTitle>
          <p className="text-sm text-muted-foreground">Download attendance data aligned with your current filters</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Summary Report */}
            <Button
              variant="outline"
              className="h-28 flex flex-col items-center justify-center gap-2"
              onClick={() => handleExportReport()}
              disabled={isExporting}
            >
              <FileSpreadsheet className="h-8 w-8 text-blue-600" />
              <div className="text-center">
                <div className="font-semibold">Export Summary CSV</div>
                <div className="text-xs text-muted-foreground">Quick overview report</div>
              </div>
            </Button>

            {/* Single Student Report */}
            <div className="flex flex-col gap-2">
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student: any) => {
                    // Format name as: first_name father_name grandfather_name
                    const fullName = [
                      student.first_name,
                      student.father_name,
                      student.grandfather_name
                    ].filter(Boolean).join(' ').trim() || student.id;

                    return (
                      <SelectItem key={student.id} value={student.id}>
                        {fullName}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className="flex-1 flex flex-col items-center justify-center gap-2"
                onClick={() => handleExportPDF('student')}
                disabled={isExporting || !selectedStudent}
              >
                <User className="h-6 w-6 text-purple-600" />
                <div className="text-center">
                  <div className="font-semibold text-sm">Student Report PDF</div>
                </div>
              </Button>
            </div>

            {/* Class Report */}
            <Button
              variant="outline"
              className="h-28 flex flex-col items-center justify-center gap-2"
              onClick={() => handleExportPDF('class')}
              disabled={isExporting || !selectedClass || selectedClass === 'all'}
            >
              <Users className="h-8 w-8 text-green-600" />
              <div className="text-center">
                <div className="font-semibold">Class Report PDF</div>
                <div className="text-xs text-muted-foreground">Detailed class breakdown</div>
              </div>
            </Button>

            {/* Monthly Report */}
            <Button
              variant="outline"
              className="h-28 flex flex-col items-center justify-center gap-2"
              onClick={() => handleExportPDF('monthly')}
              disabled={isExporting}
            >
              <Calendar className="h-8 w-8 text-indigo-600" />
              <div className="text-center">
                <div className="font-semibold">Monthly Report PDF</div>
                <div className="text-xs text-muted-foreground">Period summary with trends</div>
              </div>
            </Button>

            {/* Concerns Report */}
            <Button
              variant="outline"
              className="h-28 flex flex-col items-center justify-center gap-2"
              onClick={() => handleExportPDF('concerns')}
              disabled={isExporting}
            >
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div className="text-center">
                <div className="font-semibold">Concerns Report PDF</div>
                <div className="text-xs text-muted-foreground">Students needing attention</div>
              </div>
            </Button>

            {/* Comprehensive Report - Only for admins */}
            {userRole !== 'teacher' && (
              <Button
                variant="outline"
                className="h-28 flex flex-col items-center justify-center gap-2"
                onClick={() => handleExportPDF('comprehensive')}
                disabled={isExporting}
              >
                <FileText className="h-8 w-8 text-orange-600" />
                <div className="text-center">
                  <div className="font-semibold">Comprehensive PDF</div>
                  <div className="text-xs text-muted-foreground">Complete analysis report</div>
                </div>
              </Button>
            )}

          </div>
        </CardContent>
      </Card>
    </div>
  );
};
