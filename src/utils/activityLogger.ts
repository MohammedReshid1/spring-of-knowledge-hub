import { addActivity } from '@/components/common/ActivityCenter';

export const logStudentActivity = {
  create: (studentData: any) => {
    addActivity({
      type: 'student',
      title: 'Add Student',
      message: `Student "${studentData.first_name} ${studentData.last_name}" added successfully`,
      severity: 'success',
      details: `Student ID: ${studentData.student_id}\nGrade: ${studentData.grade_level}\nBranch: ${studentData.branch_id || 'Main Branch'}`
    });
  },
  
  update: (studentData: any) => {
    addActivity({
      type: 'student',
      title: 'Update Student',
      message: `Student "${studentData.first_name} ${studentData.last_name}" updated successfully`,
      severity: 'success',
      details: `Student ID: ${studentData.student_id}\nUpdated fields: Name, contact info, or academic details`
    });
  },

  delete: (studentId: string, studentName?: string) => {
    addActivity({
      type: 'student',
      title: 'Delete Student',
      message: `Student ${studentName ? `"${studentName}"` : ''} deleted successfully`,
      severity: 'warning',
      details: `Deleted student ID: ${studentId}`
    });
  },

  bulkDelete: (count: number, studentIds: string[]) => {
    addActivity({
      type: 'student',
      title: 'Bulk Delete Students',
      message: `${count} students deleted successfully`,
      severity: 'warning',
      details: `Deleted student IDs: ${studentIds.join(', ')}`
    });
  }
};

export const logClassActivity = {
  create: (classData: any) => {
    addActivity({
      type: 'class',
      title: 'Add Class',
      message: `Class "${classData.class_name}" created successfully`,
      severity: 'success',
      details: `Class capacity: ${classData.max_capacity}\nAcademic year: ${classData.academic_year}`
    });
  },

  update: (classData: any) => {
    addActivity({
      type: 'class',
      title: 'Update Class',
      message: `Class "${classData.class_name}" updated successfully`,
      severity: 'success',
      details: `Updated class configuration and enrollment settings`
    });
  },

  delete: (className: string) => {
    addActivity({
      type: 'class',
      title: 'Delete Class',
      message: `Class "${className}" deleted successfully`,
      severity: 'warning',
      details: `Class removal may affect student assignments`
    });
  }
};

export const logPaymentActivity = {
  create: (paymentData: any) => {
    addActivity({
      type: 'payment',
      title: 'Payment Recorded',
      message: `Payment of ${paymentData.amount_paid} recorded successfully`,
      severity: 'success',
      details: `Student: ${paymentData.student_name || 'Unknown'}\nPayment method: ${paymentData.payment_method}\nStatus: ${paymentData.payment_status}`
    });
  },

  update: (paymentData: any) => {
    addActivity({
      type: 'payment',
      title: 'Payment Updated',
      message: `Payment record updated successfully`,
      severity: 'info',
      details: `Updated payment status or amount for student payment`
    });
  },

  bulkImport: (successCount: number, errorCount: number, details: string) => {
    addActivity({
      type: 'payment',
      title: 'Bulk Payment Import',
      message: `Import completed: ${successCount} successful, ${errorCount} errors`,
      severity: errorCount > 0 ? 'warning' : 'success',
      details: details
    });
  }
};

export const logUserActivity = {
  create: (userData: any) => {
    addActivity({
      type: 'user',
      title: 'Add User',
      message: `User "${userData.full_name}" created successfully`,
      severity: 'success',
      details: `Role: ${userData.role}\nEmail: ${userData.email}\nBranch: ${userData.branch_id || 'All branches'}`
    });
  },

  update: (userData: any) => {
    addActivity({
      type: 'user',
      title: 'Update User',
      message: `User "${userData.full_name}" updated successfully`,
      severity: 'success',
      details: `Updated user profile or permissions`
    });
  },

  delete: (userName: string) => {
    addActivity({
      type: 'user',
      title: 'Delete User',
      message: `User "${userName}" deleted successfully`,
      severity: 'warning',
      details: `User account and access permissions removed`
    });
  }
};

export const logSystemActivity = {
  backup: (backupInfo: any) => {
    addActivity({
      type: 'system',
      title: 'Database Backup',
      message: 'Database backup completed successfully',
      severity: 'success',
      details: `Backup type: ${backupInfo.type}\nTables backed up: ${backupInfo.tables?.join(', ')}\nRecords: ${backupInfo.recordCount}`
    });
  },

  error: (errorMessage: string, details?: string) => {
    addActivity({
      type: 'system',
      title: 'System Error',
      message: errorMessage,
      severity: 'error',
      details: details
    });
  }
};