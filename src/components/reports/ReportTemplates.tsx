import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Search, Plus, FileText, Settings, Copy, Trash2, Edit, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface ReportTemplate {
  id: string;
  template_name: string;
  description: string;
  report_type: string;
  template_format: string;
  template_content: any;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const ReportTemplates: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    template_name: '',
    description: '',
    report_type: '',
    template_format: 'PDF'
  });

  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery<ReportTemplate[]>({
    queryKey: ['report-templates'],
    queryFn: async () => {
      const response = await apiClient.get('/reports/templates');
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (templateData: any) => {
      const response = await apiClient.post('/reports/templates', templateData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-templates'] });
      setIsCreateDialogOpen(false);
      setCreateForm({
        template_name: '',
        description: '',
        report_type: '',
        template_format: 'PDF'
      });
      toast.success('Template created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create template');
    },
  });

  const filteredTemplates = templates.filter(template =>
    template.template_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.report_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateTemplate = () => {
    const templateData = {
      ...createForm,
      template_content: {
        sections: ["header", "data", "footer"],
        default_fields: ["student_name", "date", "signature"]
      },
      is_active: true
    };
    createMutation.mutate(templateData);
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading report templates...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Report Templates</h2>
          <p className="text-muted-foreground">Create and manage reusable report templates</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Report Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="template_name">Template Name</Label>
                <Input
                  id="template_name"
                  value={createForm.template_name}
                  onChange={(e) => setCreateForm(prev => ({...prev, template_name: e.target.value}))}
                  placeholder="Student Report Card Template"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={createForm.description}
                  onChange={(e) => setCreateForm(prev => ({...prev, description: e.target.value}))}
                  placeholder="Template for generating student report cards with grades and attendance"
                />
              </div>
              <div>
                <Label htmlFor="report_type">Report Type</Label>
                <Select value={createForm.report_type} onValueChange={(value) => setCreateForm(prev => ({...prev, report_type: value}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="academic">Academic Report</SelectItem>
                    <SelectItem value="attendance">Attendance Report</SelectItem>
                    <SelectItem value="financial">Financial Report</SelectItem>
                    <SelectItem value="behavioral">Behavioral Report</SelectItem>
                    <SelectItem value="progress">Progress Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="format">Format</Label>
                <Select value={createForm.template_format} onValueChange={(value) => setCreateForm(prev => ({...prev, template_format: value}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PDF">PDF</SelectItem>
                    <SelectItem value="EXCEL">Excel</SelectItem>
                    <SelectItem value="CSV">CSV</SelectItem>
                    <SelectItem value="HTML">HTML</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateTemplate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Template'}
                </Button>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search report templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{template.template_name}</CardTitle>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {template.report_type}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {template.template_format}
                      </Badge>
                      {template.is_active ? (
                        <Badge className="text-xs bg-green-100 text-green-800">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Inactive</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {template.description}
                </p>
                <div className="text-xs text-muted-foreground mb-4">
                  <p>Created: {new Date(template.created_at).toLocaleDateString()}</p>
                  <p>Updated: {new Date(template.updated_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline">
                    <Copy className="h-3 w-3 mr-1" />
                    Clone
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 hover:text-red-800">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">
              {searchTerm ? 'No templates match your search' : 'No report templates yet'}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Create reusable templates for generating consistent reports across your school
            </p>
            {!searchTerm && (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Template
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      {templates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Template Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{templates.length}</div>
                <p className="text-sm text-muted-foreground">Total Templates</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {templates.filter(t => t.is_active).length}
                </div>
                <p className="text-sm text-muted-foreground">Active Templates</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {new Set(templates.map(t => t.report_type)).size}
                </div>
                <p className="text-sm text-muted-foreground">Report Types</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {new Set(templates.map(t => t.template_format)).size}
                </div>
                <p className="text-sm text-muted-foreground">Output Formats</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};