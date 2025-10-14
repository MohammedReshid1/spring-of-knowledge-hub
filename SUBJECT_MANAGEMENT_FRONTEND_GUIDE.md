# Subject Management System - Frontend Integration Guide

**Last Updated:** October 9, 2025
**System Status:** ✅ Production Ready
**API Version:** v1
**Base URL:** `/subjects`

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Complete API Reference](#complete-api-reference)
3. [Authentication & Permissions](#authentication--permissions)
4. [Data Models & TypeScript Interfaces](#data-models--typescript-interfaces)
5. [Frontend Implementation Examples](#frontend-implementation-examples)
6. [UI/UX Requirements](#uiux-requirements)
7. [Key Components to Build](#key-components-to-build)
8. [Error Handling](#error-handling)
9. [Best Practices](#best-practices)
10. [Common Use Cases](#common-use-cases)

---

## System Overview

### ✅ What's Implemented

The subject management system provides **5 complete endpoints** covering:

- ✅ **Full CRUD Operations** - Create, Read, Update, Delete
- ✅ **Branch Isolation** - Users only see subjects from their branch
- ✅ **Permission-Based Access** - Admin/superadmin role checks
- ✅ **Grade Level Association** - Subjects can be assigned to specific grade levels
- ✅ **Subject Codes** - Unique identifiers for subjects (e.g., MATH101)

### 📊 System Features

- **Multi-Branch Support** - Each branch has isolated subject data
- **Grade Level Mapping** - Subjects can be assigned to one or more grade levels
- **Search & Filter** - Search subjects by name or code
- **Audit Trail** - Created and updated timestamps tracked

---

## Complete API Reference

### Base URL

All subject endpoints are available at: `/subjects`

### 1. Create Subject

**`POST /subjects`**

Create a new subject in the system.

```typescript
// Request
POST /subjects
Authorization: Bearer {token}
Content-Type: application/json

{
  "subject_name": "Mathematics",
  "subject_code": "MATH101",
  "description": "Algebra, Geometry, and Calculus fundamentals",
  "grade_levels": ["Grade 9", "Grade 10", "Grade 11"]
}

// Response (201 Created)
{
  "id": "507f1f77bcf86cd799439011",
  "subject_name": "Mathematics",
  "subject_code": "MATH101",
  "description": "Algebra, Geometry, and Calculus fundamentals",
  "grade_levels": ["Grade 9", "Grade 10", "Grade 11"],
  "created_at": "2025-10-09T10:00:00Z"
}

// Error Response (403 Forbidden)
{
  "detail": "Only admin can create subjects"
}

// Error Response (403 Forbidden - No Branch)
{
  "detail": "User must be assigned to a branch"
}
```

**Permissions Required:** Admin or Superadmin role

**Validation Rules:**
- `subject_name`: Required, string
- `subject_code`: Required, string, unique per branch
- `description`: Optional, string
- `grade_levels`: Optional, array of strings (e.g., ["Grade 9", "Grade 10"])

---

### 2. List Subjects

**`GET /subjects`**

Retrieve all subjects for the current user's branch.

```typescript
// Request
GET /subjects
Authorization: Bearer {token}

// Response (200 OK)
[
  {
    "id": "507f1f77bcf86cd799439011",
    "subject_name": "Mathematics",
    "subject_code": "MATH101",
    "description": "Algebra, Geometry, and Calculus fundamentals",
    "grade_levels": ["Grade 9", "Grade 10", "Grade 11"],
    "created_at": "2025-10-09T10:00:00Z"
  },
  {
    "id": "507f1f77bcf86cd799439012",
    "subject_name": "English Language",
    "subject_code": "ENG101",
    "description": "Reading, Writing, and Literature",
    "grade_levels": ["Grade 9", "Grade 10"],
    "created_at": "2025-10-09T09:00:00Z"
  },
  {
    "id": "507f1f77bcf86cd799439013",
    "subject_name": "Physics",
    "subject_code": "PHY201",
    "description": "Mechanics, Thermodynamics, and Electromagnetism",
    "grade_levels": ["Grade 11", "Grade 12"],
    "created_at": "2025-10-09T08:00:00Z"
  }
]

// Empty Array (User with no branch)
[]
```

**Permissions Required:** Authenticated user

**Branch Filtering:**
- Superadmins see **all subjects** across all branches
- Regular users see **only subjects from their branch**
- Users without a branch see **no subjects**

---

### 3. Get Subject by ID

**`GET /subjects/{subject_id}`**

Retrieve a specific subject by its ID.

```typescript
// Request
GET /subjects/507f1f77bcf86cd799439011
Authorization: Bearer {token}

// Response (200 OK)
{
  "id": "507f1f77bcf86cd799439011",
  "subject_name": "Mathematics",
  "subject_code": "MATH101",
  "description": "Algebra, Geometry, and Calculus fundamentals",
  "grade_levels": ["Grade 9", "Grade 10", "Grade 11"],
  "created_at": "2025-10-09T10:00:00Z"
}

// Error Response (404 Not Found)
{
  "detail": "Subject not found"
}
```

**Permissions Required:** Authenticated user

---

### 4. Update Subject

**`PUT /subjects/{subject_id}`**

Update an existing subject.

```typescript
// Request
PUT /subjects/507f1f77bcf86cd799439011
Authorization: Bearer {token}
Content-Type: application/json

{
  "subject_name": "Advanced Mathematics",
  "subject_code": "MATH101",
  "description": "Advanced Algebra, Geometry, Calculus, and Statistics",
  "grade_levels": ["Grade 9", "Grade 10", "Grade 11", "Grade 12"]
}

// Response (200 OK)
{
  "id": "507f1f77bcf86cd799439011",
  "subject_name": "Advanced Mathematics",
  "subject_code": "MATH101",
  "description": "Advanced Algebra, Geometry, Calculus, and Statistics",
  "grade_levels": ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
  "created_at": "2025-10-09T10:00:00Z"
}

// Error Response (404 Not Found)
{
  "detail": "Subject not found"
}
```

**Permissions Required:** Admin or Superadmin role

**Note:** This is a full replacement (PUT), not a partial update (PATCH). All fields must be provided.

---

### 5. Delete Subject

**`DELETE /subjects/{subject_id}`**

Delete a subject from the system.

```typescript
// Request
DELETE /subjects/507f1f77bcf86cd799439011
Authorization: Bearer {token}

// Response (204 No Content)
// Empty response body

// Error Response (404 Not Found)
{
  "detail": "Subject not found"
}
```

**Permissions Required:** Admin or Superadmin role

**⚠️ Warning:** This is a **hard delete**. The subject is permanently removed from the database. Consider implementing soft delete in the future for audit purposes.

---

## Authentication & Permissions

### Authentication

All subject endpoints require authentication via JWT token:

```typescript
// Login first
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'username=admin@example.com&password=password123'
});

const { access_token } = await loginResponse.json();

// Use token in all requests
const response = await fetch('/subjects', {
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  }
});
```

---

### Permission System

The subject system uses **role-based access control**:

#### Available Permissions (Implicit)

| Permission | Description | Operations |
|------------|-------------|------------|
| `subject.create` | Create subjects | POST endpoints |
| `subject.read` | View subjects | GET endpoints |
| `subject.update` | Update subjects | PUT endpoints |
| `subject.delete` | Delete subjects | DELETE endpoints |
| `subject.manage` | Full subject management | All operations |

**Note:** Currently, the backend checks for admin/superadmin **roles** rather than granular permissions. Future updates will use proper RBAC with `subject.*` permissions.

#### Role-Based Access (Current Implementation)

| Role | Create | Read | Update | Delete |
|------|--------|------|--------|--------|
| **Superadmin** | ✅ | ✅ | ✅ | ✅ |
| **Admin** | ✅ | ✅ | ✅ | ✅ |
| **Branch Admin** | ❌* | ✅ | ❌* | ❌* |
| **Teacher** | ❌ | ✅ | ❌ | ❌ |
| **Student/Parent** | ❌ | ✅ | ❌ | ❌ |

*Currently restricted by hard-coded role check. Will be permission-based in future updates.

---

### Permission Checks Example

```typescript
// Frontend permission checking
interface User {
  role: string;
  permissions: string[];
}

function canManageSubjects(user: User): boolean {
  // Current implementation: Check role
  return ['admin', 'superadmin', 'super_admin'].includes(user.role);
}

function canViewSubjects(user: User): boolean {
  // All authenticated users can view
  return true;
}

// Usage in UI
{canManageSubjects(user) && (
  <button onClick={handleCreateSubject}>Add Subject</button>
)}

{canManageSubjects(user) && (
  <button onClick={handleEditSubject}>Edit Subject</button>
)}

{canManageSubjects(user) && (
  <button onClick={handleDeleteSubject}>Delete Subject</button>
)}
```

---

## Data Models & TypeScript Interfaces

```typescript
// Subject Data Types
interface SubjectCreate {
  subject_name: string;
  subject_code: string;
  description?: string;
  grade_levels?: string[];
}

interface Subject {
  id: string;
  subject_name: string;
  subject_code: string;
  description?: string;
  grade_levels: string[];
  created_at: string; // ISO 8601 datetime
}

// API Response Types
interface SubjectListResponse {
  subjects: Subject[];
}

interface SubjectResponse {
  subject: Subject;
}

interface ErrorResponse {
  detail: string;
}

// Form Data Types
interface SubjectFormData {
  subject_name: string;
  subject_code: string;
  description: string;
  grade_levels: string[];
}

// Validation Schema (Yup example)
import * as yup from 'yup';

const subjectSchema = yup.object({
  subject_name: yup
    .string()
    .required('Subject name is required')
    .min(2, 'Subject name must be at least 2 characters')
    .max(100, 'Subject name must not exceed 100 characters'),

  subject_code: yup
    .string()
    .required('Subject code is required')
    .matches(/^[A-Z0-9]+$/, 'Subject code must be uppercase letters and numbers only')
    .min(3, 'Subject code must be at least 3 characters')
    .max(20, 'Subject code must not exceed 20 characters'),

  description: yup
    .string()
    .max(500, 'Description must not exceed 500 characters'),

  grade_levels: yup
    .array()
    .of(yup.string())
    .min(1, 'At least one grade level must be selected')
});
```

---

## Frontend Implementation Examples

### React/TypeScript Example

```typescript
import { useState, useEffect } from 'react';
import axios from 'axios';

// API Client
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const subjectAPI = axios.create({
  baseURL: `${API_BASE_URL}/subjects`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth interceptor
subjectAPI.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// API Functions
export const subjectService = {
  // Get all subjects
  getAll: async (): Promise<Subject[]> => {
    const response = await subjectAPI.get('/');
    return response.data;
  },

  // Get subject by ID
  getById: async (id: string): Promise<Subject> => {
    const response = await subjectAPI.get(`/${id}`);
    return response.data;
  },

  // Create subject
  create: async (data: SubjectCreate): Promise<Subject> => {
    const response = await subjectAPI.post('/', data);
    return response.data;
  },

  // Update subject
  update: async (id: string, data: SubjectCreate): Promise<Subject> => {
    const response = await subjectAPI.put(`/${id}`, data);
    return response.data;
  },

  // Delete subject
  delete: async (id: string): Promise<void> => {
    await subjectAPI.delete(`/${id}`);
  },
};

// React Component - Subject List
function SubjectList() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSubjects();
  }, []);

  async function loadSubjects() {
    try {
      setLoading(true);
      const data = await subjectService.getAll();
      setSubjects(data);
    } catch (err) {
      setError('Failed to load subjects');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this subject?')) return;

    try {
      await subjectService.delete(id);
      setSubjects(subjects.filter(s => s.id !== id));
      alert('Subject deleted successfully');
    } catch (err) {
      alert('Failed to delete subject');
      console.error(err);
    }
  }

  if (loading) return <div>Loading subjects...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="subject-list">
      <h1>Subjects</h1>
      <button onClick={() => /* navigate to create */}>Add Subject</button>

      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Description</th>
            <th>Grade Levels</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map(subject => (
            <tr key={subject.id}>
              <td>{subject.subject_code}</td>
              <td>{subject.subject_name}</td>
              <td>{subject.description || '-'}</td>
              <td>{subject.grade_levels.join(', ') || '-'}</td>
              <td>
                <button onClick={() => /* navigate to edit */}>Edit</button>
                <button onClick={() => handleDelete(subject.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// React Component - Subject Form
function SubjectForm({ subjectId }: { subjectId?: string }) {
  const [formData, setFormData] = useState<SubjectFormData>({
    subject_name: '',
    subject_code: '',
    description: '',
    grade_levels: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (subjectId) {
      loadSubject(subjectId);
    }
  }, [subjectId]);

  async function loadSubject(id: string) {
    try {
      const subject = await subjectService.getById(id);
      setFormData({
        subject_name: subject.subject_name,
        subject_code: subject.subject_code,
        description: subject.description || '',
        grade_levels: subject.grade_levels,
      });
    } catch (err) {
      setError('Failed to load subject');
      console.error(err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (subjectId) {
        await subjectService.update(subjectId, formData);
        alert('Subject updated successfully');
      } else {
        await subjectService.create(formData);
        alert('Subject created successfully');
      }
      // Navigate back to list
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Operation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="subject-form">
      <h1>{subjectId ? 'Edit Subject' : 'Create Subject'}</h1>

      {error && <div className="error">{error}</div>}

      <div className="form-group">
        <label htmlFor="subject_code">Subject Code *</label>
        <input
          type="text"
          id="subject_code"
          value={formData.subject_code}
          onChange={(e) => setFormData({ ...formData, subject_code: e.target.value.toUpperCase() })}
          placeholder="e.g., MATH101"
          required
          pattern="[A-Z0-9]+"
          title="Uppercase letters and numbers only"
        />
      </div>

      <div className="form-group">
        <label htmlFor="subject_name">Subject Name *</label>
        <input
          type="text"
          id="subject_name"
          value={formData.subject_name}
          onChange={(e) => setFormData({ ...formData, subject_name: e.target.value })}
          placeholder="e.g., Mathematics"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief description of the subject"
          rows={3}
        />
      </div>

      <div className="form-group">
        <label>Grade Levels *</label>
        <div className="checkbox-group">
          {['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map(grade => (
            <label key={grade}>
              <input
                type="checkbox"
                checked={formData.grade_levels.includes(grade)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setFormData({
                      ...formData,
                      grade_levels: [...formData.grade_levels, grade]
                    });
                  } else {
                    setFormData({
                      ...formData,
                      grade_levels: formData.grade_levels.filter(g => g !== grade)
                    });
                  }
                }}
              />
              {grade}
            </label>
          ))}
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" disabled={loading}>
          {loading ? 'Saving...' : subjectId ? 'Update Subject' : 'Create Subject'}
        </button>
        <button type="button" onClick={() => /* navigate back */}>Cancel</button>
      </div>
    </form>
  );
}

export { SubjectList, SubjectForm };
```

---

### React Query Hooks

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subjectService } from './subjectService';

// Get all subjects
export function useSubjects() {
  return useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectService.getAll(),
  });
}

// Get single subject
export function useSubject(id: string) {
  return useQuery({
    queryKey: ['subjects', id],
    queryFn: () => subjectService.getById(id),
    enabled: !!id,
  });
}

// Create subject
export function useCreateSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SubjectCreate) => subjectService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
  });
}

// Update subject
export function useUpdateSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SubjectCreate }) =>
      subjectService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
  });
}

// Delete subject
export function useDeleteSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => subjectService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
  });
}

// Usage in component
function SubjectListWithHooks() {
  const { data: subjects, isLoading, error } = useSubjects();
  const deleteSubject = useDeleteSubject();

  async function handleDelete(id: string) {
    if (!confirm('Are you sure?')) return;

    try {
      await deleteSubject.mutateAsync(id);
      alert('Subject deleted');
    } catch (err) {
      alert('Failed to delete subject');
    }
  }

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading subjects</div>;

  return (
    <div>
      {subjects?.map(subject => (
        <div key={subject.id}>
          <h3>{subject.subject_name}</h3>
          <button onClick={() => handleDelete(subject.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
```

---

## UI/UX Requirements

### Design Principles

1. **Clean & Organized**: Clear hierarchy, easy to scan
2. **Color-Coded**: Use consistent colors for subjects
3. **Responsive**: Works on desktop, tablet, and mobile
4. **Accessible**: WCAG 2.1 AA compliance
5. **Fast**: Optimistic updates, instant feedback

### Recommended UI Components

#### 1. Subject List View

```
┌─────────────────────────────────────────────────────────┐
│ Subjects                                    [+ Add]     │
├─────────────────────────────────────────────────────────┤
│ Search: [___________]    Filter: [All Grade Levels ▼]  │
├─────────────────────────────────────────────────────────┤
│ CODE     │ NAME           │ GRADE LEVELS   │ ACTIONS   │
├──────────┼────────────────┼────────────────┼───────────┤
│ MATH101  │ Mathematics    │ 9, 10, 11     │ Edit Del  │
│ ENG101   │ English        │ 9, 10         │ Edit Del  │
│ PHY201   │ Physics        │ 11, 12        │ Edit Del  │
│ CHEM201  │ Chemistry      │ 11, 12        │ Edit Del  │
│ BIO101   │ Biology        │ 9, 10, 11, 12 │ Edit Del  │
└─────────────────────────────────────────────────────────┘
```

#### 2. Subject Form (Create/Edit)

```
┌─────────────────────────────────────────────┐
│ Create Subject                        [×]   │
├─────────────────────────────────────────────┤
│                                             │
│ Subject Code *                              │
│ [MATH101____________]                       │
│ (Uppercase letters and numbers only)       │
│                                             │
│ Subject Name *                              │
│ [Mathematics_________________________]      │
│                                             │
│ Description                                 │
│ [____________________________________]      │
│ [____________________________________]      │
│ [____________________________________]      │
│                                             │
│ Grade Levels *                              │
│ ☑ Grade 9   ☑ Grade 10                     │
│ ☑ Grade 11  ☐ Grade 12                     │
│                                             │
│              [Cancel]  [Create Subject]     │
└─────────────────────────────────────────────┘
```

#### 3. Subject Card View (Alternative)

```
┌───────────────────┐  ┌───────────────────┐
│ MATH101          │  │ ENG101           │
│                  │  │                  │
│ Mathematics      │  │ English Language │
│                  │  │                  │
│ Grade 9-11       │  │ Grade 9-10       │
│                  │  │                  │
│ [Edit] [Delete]  │  │ [Edit] [Delete]  │
└───────────────────┘  └───────────────────┘
```

---

## Key Components to Build

### 1. SubjectList Component

```typescript
interface SubjectListProps {
  editable?: boolean;
  onSubjectClick?: (subject: Subject) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

// Features:
// - Table or card view toggle
// - Search by name or code
// - Filter by grade level
// - Sort by name, code, or creation date
// - Pagination (if many subjects)
// - Bulk actions (select multiple, delete)
// - Export to CSV
```

### 2. SubjectForm Component

```typescript
interface SubjectFormProps {
  mode: 'create' | 'edit';
  subjectId?: string;
  initialData?: Subject;
  onSubmit: (data: SubjectCreate) => void;
  onCancel: () => void;
}

// Features:
// - Form validation with real-time feedback
// - Subject code format validation (uppercase)
// - Duplicate code detection
// - Grade level multi-select checkboxes
// - Auto-save draft (optional)
// - Submit/Cancel buttons
```

### 3. SubjectCard Component

```typescript
interface SubjectCardProps {
  subject: Subject;
  onEdit?: () => void;
  onDelete?: () => void;
  clickable?: boolean;
}

// Features:
// - Displays subject code and name
// - Shows grade levels as badges
// - Edit/Delete action buttons
// - Hover effect
// - Click to view details
```

### 4. GradeLevelSelector Component

```typescript
interface GradeLevelSelectorProps {
  selected: string[];
  onChange: (levels: string[]) => void;
  options?: string[];
}

// Features:
// - Checkbox group for grade levels
// - Select all / Deselect all
// - Visual indication of selection
// - Customizable grade level options
```

---

## Error Handling

### Common Error Responses

```typescript
// 1. 401 Unauthorized - Not logged in
{
  "detail": "Not authenticated"
}

// 2. 403 Forbidden - Insufficient permissions
{
  "detail": "Only admin can create subjects"
}

// 3. 403 Forbidden - No branch assigned
{
  "detail": "User must be assigned to a branch"
}

// 4. 404 Not Found
{
  "detail": "Subject not found"
}

// 5. 400 Bad Request - Validation error
{
  "detail": "Subject code already exists"
}
```

### Error Handler

```typescript
async function handleAPIError(error: any) {
  if (error.response) {
    const status = error.response.status;
    const detail = error.response.data?.detail || 'An error occurred';

    switch (status) {
      case 401:
        // Redirect to login
        localStorage.removeItem('access_token');
        window.location.href = '/login';
        break;

      case 403:
        if (detail.includes('branch')) {
          alert('You must be assigned to a branch to perform this action');
        } else {
          alert('You do not have permission to perform this action');
        }
        break;

      case 404:
        alert('Subject not found. It may have been deleted.');
        break;

      case 400:
        alert(`Validation error: ${detail}`);
        break;

      default:
        alert(`Error: ${detail}`);
    }
  } else {
    alert('Network error. Please check your connection.');
  }
}

// Usage
try {
  await subjectService.create(formData);
} catch (error) {
  await handleAPIError(error);
}
```

---

## Best Practices

### 1. Permission Checking

```typescript
// Always check permissions before rendering UI
function SubjectActions({ user, subject }: { user: User; subject: Subject }) {
  const canEdit = ['admin', 'superadmin'].includes(user.role);
  const canDelete = ['admin', 'superadmin'].includes(user.role);

  return (
    <div className="actions">
      <button onClick={() => viewSubject(subject.id)}>View</button>
      {canEdit && <button onClick={() => editSubject(subject.id)}>Edit</button>}
      {canDelete && <button onClick={() => deleteSubject(subject.id)}>Delete</button>}
    </div>
  );
}
```

### 2. Optimistic Updates

```typescript
// Update UI immediately, rollback on error
async function deleteSubjectOptimistically(id: string) {
  const previousSubjects = [...subjects];

  // Optimistically remove from UI
  setSubjects(subjects.filter(s => s.id !== id));

  try {
    await subjectService.delete(id);
    // Success! UI already updated
  } catch (error) {
    // Rollback on error
    setSubjects(previousSubjects);
    alert('Failed to delete subject');
  }
}
```

### 3. Form Validation

```typescript
// Validate before submitting
function validateSubjectForm(data: SubjectFormData): string[] {
  const errors: string[] = [];

  if (!data.subject_code) {
    errors.push('Subject code is required');
  } else if (!/^[A-Z0-9]+$/.test(data.subject_code)) {
    errors.push('Subject code must be uppercase letters and numbers only');
  }

  if (!data.subject_name) {
    errors.push('Subject name is required');
  }

  if (data.grade_levels.length === 0) {
    errors.push('At least one grade level must be selected');
  }

  return errors;
}
```

### 4. Caching with React Query

```typescript
// Configure React Query for optimal caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
    },
  },
});
```

---

## Common Use Cases

### 1. Display All Subjects for a Branch

```typescript
function BranchSubjects() {
  const { data: subjects, isLoading } = useSubjects();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="subjects-grid">
      {subjects?.map(subject => (
        <SubjectCard key={subject.id} subject={subject} />
      ))}
    </div>
  );
}
```

### 2. Create a New Subject

```typescript
function CreateSubjectPage() {
  const createSubject = useCreateSubject();
  const navigate = useNavigate();

  async function handleSubmit(data: SubjectCreate) {
    try {
      await createSubject.mutateAsync(data);
      alert('Subject created successfully');
      navigate('/subjects');
    } catch (error) {
      alert('Failed to create subject');
    }
  }

  return (
    <SubjectForm
      mode="create"
      onSubmit={handleSubmit}
      onCancel={() => navigate('/subjects')}
    />
  );
}
```

### 3. Edit Existing Subject

```typescript
function EditSubjectPage({ id }: { id: string }) {
  const { data: subject } = useSubject(id);
  const updateSubject = useUpdateSubject();
  const navigate = useNavigate();

  async function handleSubmit(data: SubjectCreate) {
    try {
      await updateSubject.mutateAsync({ id, data });
      alert('Subject updated successfully');
      navigate('/subjects');
    } catch (error) {
      alert('Failed to update subject');
    }
  }

  if (!subject) return <div>Loading...</div>;

  return (
    <SubjectForm
      mode="edit"
      subjectId={id}
      initialData={subject}
      onSubmit={handleSubmit}
      onCancel={() => navigate('/subjects')}
    />
  );
}
```

### 4. Filter Subjects by Grade Level

```typescript
function SubjectsFilteredByGrade() {
  const [selectedGrade, setSelectedGrade] = useState<string>('Grade 9');
  const { data: subjects } = useSubjects();

  const filteredSubjects = subjects?.filter(subject =>
    subject.grade_levels.includes(selectedGrade)
  );

  return (
    <div>
      <select value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)}>
        <option value="Grade 9">Grade 9</option>
        <option value="Grade 10">Grade 10</option>
        <option value="Grade 11">Grade 11</option>
        <option value="Grade 12">Grade 12</option>
      </select>

      <div className="subjects-list">
        {filteredSubjects?.map(subject => (
          <SubjectCard key={subject.id} subject={subject} />
        ))}
      </div>
    </div>
  );
}
```

### 5. Search Subjects

```typescript
function SubjectSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: subjects } = useSubjects();

  const searchResults = subjects?.filter(subject =>
    subject.subject_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    subject.subject_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <input
        type="search"
        placeholder="Search subjects..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
      />

      <div className="search-results">
        {searchResults?.map(subject => (
          <SubjectCard key={subject.id} subject={subject} />
        ))}
        {searchResults?.length === 0 && (
          <p>No subjects found matching "{searchQuery}"</p>
        )}
      </div>
    </div>
  );
}
```

---

## Project Structure

```
subject-management/
├── src/
│   ├── api/
│   │   ├── client.ts               # Axios instance
│   │   └── subject.api.ts          # Subject API calls
│   │
│   ├── components/
│   │   ├── subjects/
│   │   │   ├── SubjectList.tsx
│   │   │   ├── SubjectCard.tsx
│   │   │   ├── SubjectForm.tsx
│   │   │   ├── SubjectDetails.tsx
│   │   │   └── GradeLevelSelector.tsx
│   │   │
│   │   └── common/
│   │       ├── Loading.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── PermissionGuard.tsx
│   │
│   ├── hooks/
│   │   ├── useSubjects.ts
│   │   ├── usePermissions.ts
│   │   └── useDebounce.ts
│   │
│   ├── pages/
│   │   ├── SubjectsPage.tsx
│   │   ├── CreateSubjectPage.tsx
│   │   ├── EditSubjectPage.tsx
│   │   └── SubjectDetailsPage.tsx
│   │
│   ├── types/
│   │   ├── subject.types.ts
│   │   └── user.types.ts
│   │
│   ├── utils/
│   │   ├── validation.ts
│   │   └── formatters.ts
│   │
│   ├── App.tsx
│   └── main.tsx
│
└── package.json
```

---

## Testing Checklist

### Manual Testing

- [ ] Create a new subject with all fields
- [ ] Create a subject with minimum required fields
- [ ] Edit an existing subject
- [ ] Delete a subject
- [ ] View all subjects as admin
- [ ] View subjects as regular user (branch filtering)
- [ ] Try to create subject without admin role (should fail)
- [ ] Try to create subject without branch (should fail)
- [ ] Search subjects by name
- [ ] Search subjects by code
- [ ] Filter subjects by grade level
- [ ] Verify form validation (empty fields, invalid code format)
- [ ] Test on mobile device
- [ ] Test keyboard navigation
- [ ] Test screen reader compatibility

---

## Summary

### ✅ What's Available

1. **5 API Endpoints** - Full CRUD operations
2. **Branch Isolation** - Automatic filtering by branch
3. **Role-Based Access** - Admin/superadmin restrictions
4. **Grade Level Mapping** - Subjects linked to grade levels
5. **Subject Codes** - Unique identifiers (e.g., MATH101)

### 📝 What to Build

1. **Subject List** - Table or card view with search/filter
2. **Subject Form** - Create/edit with validation
3. **Subject Card** - Visual representation
4. **Grade Level Selector** - Multi-select component
5. **Permission Guards** - Hide/show based on role

### 🚀 Next Steps

1. Review this guide thoroughly
2. Set up project with chosen tech stack
3. Implement API client and authentication
4. Build subject list component
5. Build subject form component
6. Add search and filter functionality
7. Implement permission-based UI
8. Test thoroughly
9. Deploy and iterate

---

**Good luck building the Subject Management System!** 🎓

If you have questions, refer to this guide or the backend API documentation at `/docs`.
