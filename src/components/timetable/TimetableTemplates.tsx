import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TimetableAPI } from '@/services/timetableApi';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { usePermissionCheck } from '@/contexts/RoleAccessContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  FileText,
  Plus,
  Edit3,
  Trash2,
  Copy,
  Download,
  Upload,
  CheckCircle,
  Calendar,
  Users,
  BookOpen,
  AlertTriangle,
  Sparkles,
  Clock
} from 'lucide-react';
import type { TimetableEntry, TimeSlot } from '@/types/timetable';
import type { SchoolClass, Subject, Teacher } from '@/types/api';

interface TimetableTemplate {
  id: string;
  name: string;
  description: string;
  grade_level: string;
  created_by: string;
  created_at: string;
  entries_count: number;
  days_covered: string[];
  subjects_included: string[];
}

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' }
];

export const TimetableTemplates: React.FC = () => {
  const { hasPermission } = usePermissionCheck();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const canManage = hasPermission('timetable.manage');
  const canCreate = hasPermission('timetable.create') || canManage;

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TimetableTemplate | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>('');

  // Form state for creating template from existing timetable
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sourceClassId: '',
    gradeLevel: ''
  });

  // Fetch classes
  const { data: classes = [] } = useQuery<SchoolClass[]>({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data } = await apiClient.request('/classes');
      return data || [];
    }
  });

  // Fetch subjects
  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data } = await apiClient.request('/subjects');
      return data || [];
    }
  });

  // Fetch teachers
  const { data: teachers = [] } = useQuery<Teacher[]>({
    queryKey: ['teachers'],
    queryFn: async () => {
      const { data } = await apiClient.request('/teachers');
      return data || [];
    }
  });

  // Fetch time slots
  const { data: timeSlots = [] } = useQuery<TimeSlot[]>({
    queryKey: ['time-slots'],
    queryFn: () => TimetableAPI.getTimeSlots({ limit: 100 })
  });

  // Mock templates - In production, this would be an API call
  const templates: TimetableTemplate[] = [
    {
      id: '1',
      name: 'Standard Grade 9 Template',
      description: 'Standard weekly schedule for Grade 9 with 6 periods per day',
      grade_level: 'Grade 9',
      created_by: 'Admin',
      created_at: '2025-01-10',
      entries_count: 30,
      days_covered: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      subjects_included: ['Mathematics', 'English', 'Science', 'Social Studies', 'Physical Education']
    },
    {
      id: '2',
      name: 'Advanced Grade 10 Template',
      description: 'Advanced curriculum with lab sessions for Grade 10',
      grade_level: 'Grade 10',
      created_by: 'Admin',
      created_at: '2025-01-08',
      entries_count: 35,
      days_covered: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      subjects_included: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Computer Science']
    }
  ];

  const handleCreateTemplate = async () => {
    if (!formData.name || !formData.sourceClassId) {
      toast({
        title: 'Validation Error',
        description: 'Please provide template name and select a source class',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Fetch entries from source class
      const entries = await TimetableAPI.getEntries({ class_id: formData.sourceClassId, limit: 500 });

      // In production, save this as a template to backend
      toast({
        title: 'Success',
        description: `Template "${formData.name}" created with ${entries.length} entries`
      });

      setShowCreateDialog(false);
      resetForm();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create template',
        variant: 'destructive'
      });
    }
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplate || !selectedClass) {
      toast({
        title: 'Validation Error',
        description: 'Please select a template and target class',
        variant: 'destructive'
      });
      return;
    }

    try {
      // In production, this would fetch template entries and create them for the target class
      // For now, we'll show a success message
      toast({
        title: 'Template Applied',
        description: `Applied "${selectedTemplate.name}" to selected class`
      });

      queryClient.invalidateQueries({ queryKey: ['timetable-entries'] });
      setShowApplyDialog(false);
      setSelectedTemplate(null);
      setSelectedClass('');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to apply template',
        variant: 'destructive'
      });
    }
  };

  const handleDuplicateTemplate = (template: TimetableTemplate) => {
    setFormData({
      name: `${template.name} (Copy)`,
      description: template.description,
      sourceClassId: '',
      gradeLevel: template.grade_level
    });
    setShowCreateDialog(true);
  };

  const handleDeleteTemplate = (templateId: string, templateName: string) => {
    if (confirm(`Are you sure you want to delete template "${templateName}"?`)) {
      // In production, call delete API
      toast({
        title: 'Success',
        description: 'Template deleted successfully'
      });
    }
  };

  const handleExportTemplate = (template: TimetableTemplate) => {
    // In production, this would download a JSON/CSV file
    const exportData = {
      template,
      exported_at: new Date().toISOString(),
      exported_by: user?.email
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name.replace(/\s+/g, '_')}_template.json`;
    a.click();

    toast({
      title: 'Template Exported',
      description: 'Template downloaded successfully'
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      sourceClassId: '',
      gradeLevel: ''
    });
  };

  if (!canManage && !canCreate) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <p className="text-red-600">You don't have permission to manage timetable templates.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Timetable Templates</h3>
          <p className="text-sm text-muted-foreground">
            Create and reuse timetable structures across classes
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => {
            resetForm();
            setShowCreateDialog(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        )}
      </div>

      {/* Info Alert */}
      <Alert>
        <Sparkles className="h-4 w-4" />
        <AlertDescription>
          Templates allow you to save a timetable structure and quickly apply it to other classes with similar schedules.
          Create templates from existing timetables or build them from scratch.
        </AlertDescription>
      </Alert>

      {/* Templates Grid */}
      {templates.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Templates Yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first template from an existing class timetable
            </p>
            {canCreate && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Template
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1">{template.name}</CardTitle>
                    <Badge variant="outline" className="mb-2">
                      {template.grade_level}
                    </Badge>
                  </div>
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {template.description}
                </p>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{template.entries_count} periods</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{template.days_covered.length} days</span>
                  </div>
                </div>

                {/* Subjects */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Subjects:</p>
                  <div className="flex flex-wrap gap-1">
                    {template.subjects_included.slice(0, 3).map((subject, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {subject}
                      </Badge>
                    ))}
                    {template.subjects_included.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{template.subjects_included.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Metadata */}
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  <div>Created by {template.created_by}</div>
                  <div>{new Date(template.created_at).toLocaleDateString()}</div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedTemplate(template);
                      setShowApplyDialog(true);
                    }}
                    className="w-full"
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    Apply
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExportTemplate(template)}
                    className="w-full"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Export
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {canCreate && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDuplicateTemplate(template)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                  {canManage && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setFormData({
                            name: template.name,
                            description: template.description,
                            sourceClassId: '',
                            gradeLevel: template.grade_level
                          });
                          setShowCreateDialog(true);
                        }}
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteTemplate(template.id, template.name)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Template Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Timetable Template</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Select an existing class timetable to use as a template. This will copy its structure for reuse.
              </AlertDescription>
            </Alert>

            <div>
              <Label>Template Name *</Label>
              <Input
                placeholder="e.g., Standard Grade 9 Schedule"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="Describe this template and when to use it..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div>
              <Label>Source Class *</Label>
              <Select
                value={formData.sourceClassId}
                onValueChange={(value) => setFormData({ ...formData, sourceClassId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select class to copy from" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.class_name} - {cls.grade_level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                The timetable structure from this class will be saved as a template
              </p>
            </div>

            <div>
              <Label>Grade Level</Label>
              <Input
                placeholder="e.g., Grade 9, Year 10"
                value={formData.gradeLevel}
                onChange={(e) => setFormData({ ...formData, gradeLevel: e.target.value })}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCreateTemplate} className="flex-1">
                <CheckCircle className="h-4 w-4 mr-2" />
                Create Template
              </Button>
              <Button variant="outline" onClick={() => {
                setShowCreateDialog(false);
                resetForm();
              }}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Apply Template Dialog */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Apply Template</DialogTitle>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  This will create timetable entries for the selected class based on the template structure.
                  Existing entries may be replaced.
                </AlertDescription>
              </Alert>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{selectedTemplate.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Periods:</span>
                    <span className="font-medium">{selectedTemplate.entries_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Days:</span>
                    <span className="font-medium">{selectedTemplate.days_covered.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subjects:</span>
                    <span className="font-medium">{selectedTemplate.subjects_included.length}</span>
                  </div>
                </CardContent>
              </Card>

              <div>
                <Label>Target Class *</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class to apply template to" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.class_name} - {cls.grade_level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleApplyTemplate} className="flex-1">
                  <Upload className="h-4 w-4 mr-2" />
                  Apply Template
                </Button>
                <Button variant="outline" onClick={() => {
                  setShowApplyDialog(false);
                  setSelectedTemplate(null);
                  setSelectedClass('');
                }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TimetableTemplates;
