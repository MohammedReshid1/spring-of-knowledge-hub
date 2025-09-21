import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Search, 
  Plus, 
  Clock, 
  Calendar, 
  Settings, 
  Play, 
  Pause, 
  Edit, 
  Trash2,
  Mail,
  Download,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface ReportSchedule {
  id: string;
  schedule_name: string;
  report_type: string;
  frequency: string;
  next_run_date: string;
  is_active: boolean;
  email_recipients: string[];
  parameters: any;
  created_at: string;
  last_run: string | null;
  status: string;
}

export const ReportSchedules: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    schedule_name: '',
    report_type: '',
    frequency: '',
    email_recipients: '',
    is_active: true
  });

  const queryClient = useQueryClient();

  const { data: schedules = [], isLoading } = useQuery<ReportSchedule[]>({
    queryKey: ['report-schedules'],
    queryFn: async () => {
      const response = await apiClient.get('/reports/schedules');
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (scheduleData: any) => {
      const response = await apiClient.post('/reports/schedules', scheduleData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-schedules'] });
      setIsCreateDialogOpen(false);
      setCreateForm({
        schedule_name: '',
        report_type: '',
        frequency: '',
        email_recipients: '',
        is_active: true
      });
      toast.success('Schedule created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create schedule');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const response = await apiClient.put(`/reports/schedules/${id}`, { is_active });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-schedules'] });
      toast.success('Schedule updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update schedule');
    },
  });

  const filteredSchedules = schedules.filter(schedule =>
    schedule.schedule_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    schedule.report_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    schedule.frequency.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateSchedule = () => {
    const scheduleData = {
      ...createForm,
      email_recipients: createForm.email_recipients.split(',').map(email => email.trim()).filter(email => email),
      parameters: {
        format: "PDF",
        auto_send: true
      }
    };
    createMutation.mutate(scheduleData);
  };

  const handleToggleSchedule = (id: string, currentStatus: boolean) => {
    toggleMutation.mutate({ id, is_active: !currentStatus });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getFrequencyIcon = (frequency: string) => {
    switch (frequency.toLowerCase()) {
      case 'daily': return <Calendar className="h-4 w-4" />;
      case 'weekly': return <Calendar className="h-4 w-4" />;
      case 'monthly': return <Calendar className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading report schedules...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Report Schedules</h2>
          <p className="text-muted-foreground">Automate report generation and distribution</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Report Schedule</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="schedule_name">Schedule Name</Label>
                <Input
                  id="schedule_name"
                  value={createForm.schedule_name}
                  onChange={(e) => setCreateForm(prev => ({...prev, schedule_name: e.target.value}))}
                  placeholder="Monthly Student Progress Reports"
                />
              </div>
              <div>
                <Label htmlFor="report_type">Report Type</Label>
                <Select value={createForm.report_type} onValueChange={(value) => setCreateForm(prev => ({...prev, report_type: value}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="academic">Academic Performance</SelectItem>
                    <SelectItem value="attendance">Attendance Summary</SelectItem>
                    <SelectItem value="financial">Financial Reports</SelectItem>
                    <SelectItem value="student_progress">Student Progress</SelectItem>
                    <SelectItem value="class_summary">Class Summary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="frequency">Frequency</Label>
                <Select value={createForm.frequency} onValueChange={(value) => setCreateForm(prev => ({...prev, frequency: value}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">Daily</SelectItem>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="email_recipients">Email Recipients</Label>
                <Input
                  id="email_recipients"
                  value={createForm.email_recipients}
                  onChange={(e) => setCreateForm(prev => ({...prev, email_recipients: e.target.value}))}
                  placeholder="admin@school.com, principal@school.com"
                />
                <p className="text-xs text-muted-foreground mt-1">Separate multiple emails with commas</p>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={createForm.is_active}
                  onCheckedChange={(checked) => setCreateForm(prev => ({...prev, is_active: checked}))}
                />
                <Label htmlFor="is_active">Start immediately</Label>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateSchedule} disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Schedule'}
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
              placeholder="Search report schedules..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </div>

      {/* Schedules List */}
      {filteredSchedules.length > 0 ? (
        <div className="space-y-4">
          {filteredSchedules.map((schedule) => (
            <Card key={schedule.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{schedule.schedule_name}</CardTitle>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline">
                        {getFrequencyIcon(schedule.frequency)}
                        <span className="ml-1">{schedule.frequency}</span>
                      </Badge>
                      <Badge variant="outline">{schedule.report_type}</Badge>
                      <Badge className={getStatusColor(schedule.status)}>
                        {schedule.is_active ? 'Active' : 'Paused'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleSchedule(schedule.id, schedule.is_active)}
                      disabled={toggleMutation.isPending}
                    >
                      {schedule.is_active ? (
                        <Pause className="h-3 w-3" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                    </Button>
                    <Button size="sm" variant="outline">
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 hover:text-red-800">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      <span>Next Run: {new Date(schedule.next_run_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <Clock className="h-4 w-4 text-green-600" />
                      <span>
                        Last Run: {schedule.last_run ? new Date(schedule.last_run).toLocaleDateString() : 'Never'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <Mail className="h-4 w-4 text-purple-600" />
                      <span>{schedule.email_recipients.length} recipients</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">
                        Created: {new Date(schedule.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {schedule.email_recipients.length > 0 && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-medium text-gray-700 mb-1">Recipients:</p>
                    <div className="flex flex-wrap gap-1">
                      {schedule.email_recipients.map((email, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {email}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">
              {searchTerm ? 'No schedules match your search' : 'No report schedules yet'}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Set up automated report generation and email distribution to streamline your workflow
            </p>
            {!searchTerm && (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Schedule
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Statistics */}
      {schedules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{schedules.length}</div>
                <p className="text-sm text-muted-foreground">Total Schedules</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {schedules.filter(s => s.is_active).length}
                </div>
                <p className="text-sm text-muted-foreground">Active Schedules</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {schedules.reduce((sum, s) => sum + s.email_recipients.length, 0)}
                </div>
                <p className="text-sm text-muted-foreground">Total Recipients</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {new Set(schedules.map(s => s.report_type)).size}
                </div>
                <p className="text-sm text-muted-foreground">Report Types</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};