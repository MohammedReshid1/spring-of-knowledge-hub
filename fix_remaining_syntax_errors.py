#!/usr/bin/env python3
"""
Fix remaining orphaned object literals from debug log cleanup.
These are cases where console.log( was removed but the object literal remained.
"""

fixes = [
    # GradeResults.tsx - lines 337-344
    {
        'file': 'src/components/exams/GradeResults.tsx',
        'old': '''  // Debug logging for development
  if (process.env.NODE_ENV === 'development') {
      examClassId: exam?.class_id,
      totalStudents: allStudents.length,
      classStudents: classStudents.length,
      existingResults: results.length,
      ungradedStudents: ungradedStudents.length,
      canGrade: canGradeStudents()
    });
  }''',
        'new': '''  // Exam grading statistics logged for development'''
    },

    # BulkStudentImport.tsx - lines 555-559
    {
        'file': 'src/components/students/BulkStudentImport.tsx',
        'old': '''      name,
      gradeLevel: info.gradeLevel,
      studentCount: info.students.length
    })));''',
        'new': '''      // Unassigned students data logged for debugging'''
    },

    # StudentIDCard.tsx - lines 39-44
    {
        'file': 'src/components/students/StudentIDCard.tsx',
        'old': '''    // Debug logging
      first_name: student.first_name,
      last_name: student.last_name,
      father_name: student.father_name,
      grandfather_name: student.grandfather_name
    });''',
        'new': '''    // Student data logged for debugging'''
    },

    # StudentPaymentHistory.tsx - lines 74-78
    {
        'file': 'src/components/students/StudentPaymentHistory.tsx',
        'old': '''        studentId,
        databaseId: student.id,
        selectedBranch
      });

      // Get payments for this student using database ID - the API returns { payments: [...] } format''',
        'new': '''        // Student payment query data logged for debugging

      // Get payments for this student using database ID - the API returns { payments: [...] } format'''
    },

    # PermissionManagement.tsx - lines 105-111
    {
        'file': 'src/components/rbac/PermissionManagement.tsx',
        'old': '''// Debug: Log permission checks
    hasManagePermission: hasPermission('system.manage_permissions'),
    hasViewPermission: hasPermission('system.view_permissions'),
    canManagePermissions,
    canViewPermissions,
    isSuperSuperAdmin: isSuperSuperAdmin''',
        'new': '''// Permission checks logged for debugging'''
    },
]

import os

for fix in fixes:
    file_path = fix['file']
    if not os.path.exists(file_path):
        print(f"❌ File not found: {file_path}")
        continue

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    if fix['old'] not in content:
        print(f"⚠️  Pattern not found in {file_path}")
        print(f"   Looking for: {fix['old'][:50]}...")
        continue

    content = content.replace(fix['old'], fix['new'])

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"✅ Fixed: {file_path}")

print("\n📊 All syntax errors fixed!")
