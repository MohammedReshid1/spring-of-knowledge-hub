import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { Badge } from '@/components/ui/badge';
import { 
  Send, 
  AlertTriangle, 
  Users, 
  Calendar, 
  Settings,
  MessageCircle,
  Zap,
  Eye,
  Mail,
  Smartphone,
  Bell
} from 'lucide-react';
import { toast } from 'sonner';

export const CreateNotification: React.FC = () => {
  const [notificationForm, setNotificationForm] = useState({
    title: '',
    message: '',
    notification_type: 'announcement',
    priority: 'medium',
    recipient_type: 'all_users',
    channels: ['in_app'],
    scheduled_for: null as Date | null,
    action_url: '',
    action_text: '',
    tags: [] as string[],
  });

  const [newTag, setNewTag] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);

  const queryClient = useQueryClient();

  const { data: templates = [] } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: async () => {
      const response = await apiClient.get('/notifications/templates');
      return response.data;
    },
  });

  const createNotificationMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/notifications', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Notification sent successfully');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      // Reset form
      setNotificationForm({
        title: '',
        message: '',
        notification_type: 'announcement',
        priority: 'medium',
        recipient_type: 'all_users',
        channels: ['in_app'],
        scheduled_for: null,
        action_url: '',
        action_text: '',
        tags: [],
      });
      setIsScheduled(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to send notification');
    },
  });

  const sendQuickAnnouncementMutation = useMutation({
    mutationFn: async (data: { title: string; message: string; recipient_type: string; priority: string }) => {
      const response = await apiClient.post('/notifications/quick/announcement', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Announcement sent successfully');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to send announcement');
    },
  });

  const sendEmergencyMutation = useMutation({
    mutationFn: async (data: { title: string; message: string }) => {
      const response = await apiClient.post('/notifications/quick/emergency', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Emergency notification sent successfully');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to send emergency notification');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!notificationForm.title.trim() || !notificationForm.message.trim()) {
      toast.error('Title and message are required');
      return;
    }

    const notificationData = {
      ...notificationForm,
      scheduled_for: isScheduled ? notificationForm.scheduled_for : null,
    };

    createNotificationMutation.mutate(notificationData);
  };

  const handleQuickAnnouncement = () => {
    if (!notificationForm.title.trim() || !notificationForm.message.trim()) {
      toast.error('Title and message are required');
      return;
    }

    sendQuickAnnouncementMutation.mutate({
      title: notificationForm.title,
      message: notificationForm.message,
      recipient_type: notificationForm.recipient_type,
      priority: notificationForm.priority,
    });
  };

  const handleEmergencyAlert = () => {
    if (!notificationForm.title.trim() || !notificationForm.message.trim()) {
      toast.error('Title and message are required');
      return;
    }

    sendEmergencyMutation.mutate({
      title: notificationForm.title,
      message: notificationForm.message,
    });
  };

  const handleChannelChange = (channel: string, checked: boolean) => {
    if (checked) {
      setNotificationForm({
        ...notificationForm,
        channels: [...notificationForm.channels, channel]
      });
    } else {
      setNotificationForm({
        ...notificationForm,
        channels: notificationForm.channels.filter(c => c !== channel)
      });
    }
  };

  const addTag = () => {
    if (newTag.trim() && !notificationForm.tags.includes(newTag.trim())) {
      setNotificationForm({
        ...notificationForm,
        tags: [...notificationForm.tags, newTag.trim()]
      });
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setNotificationForm({
      ...notificationForm,
      tags: notificationForm.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'in_app': return <Bell className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'sms': return <Smartphone className="h-4 w-4" />;
      case 'push': return <Send className="h-4 w-4" />;
      default: return <MessageCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Send Notification</h2>
        <p className="text-muted-foreground">Create and send notifications to users across the platform</p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-blue-800 flex items-center text-sm">
              <MessageCircle className="h-4 w-4 mr-2" />
              Quick Announcement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-700 mb-3">Send a general announcement to all users</p>
            <Button
              onClick={handleQuickAnnouncement}
              disabled={!notificationForm.title.trim() || !notificationForm.message.trim() || sendQuickAnnouncementMutation.isPending}
              className="w-full"
              size="sm"
            >
              {sendQuickAnnouncementMutation.isPending ? 'Sending...' : 'Send Announcement'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-red-800 flex items-center text-sm">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Emergency Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-700 mb-3">Send urgent notification to all users immediately</p>
            <Button
              onClick={handleEmergencyAlert}
              disabled={!notificationForm.title.trim() || !notificationForm.message.trim() || sendEmergencyMutation.isPending}
              variant="destructive"
              className="w-full"
              size="sm"
            >
              {sendEmergencyMutation.isPending ? 'Sending...' : 'Send Emergency Alert'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-green-800 flex items-center text-sm">
              <Calendar className="h-4 w-4 mr-2" />
              Scheduled Message
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-green-700 mb-3">Schedule notification for later delivery</p>
            <Button
              onClick={() => setIsScheduled(!isScheduled)}
              variant={isScheduled ? "default" : "outline"}
              className="w-full"
              size="sm"
            >
              {isScheduled ? 'Scheduling Enabled' : 'Enable Scheduling'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Main Notification Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Notification Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={notificationForm.title}
                  onChange={(e) => setNotificationForm({ ...notificationForm, title: e.target.value })}
                  placeholder="Enter notification title"
                  maxLength={100}
                />
                <div className="text-xs text-muted-foreground">
                  {notificationForm.title.length}/100 characters
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notification_type">Type</Label>
                <Select
                  value={notificationForm.notification_type}
                  onValueChange={(value) => setNotificationForm({ ...notificationForm, notification_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="announcement">Announcement</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="academic">Academic</SelectItem>
                    <SelectItem value="payment_reminder">Payment Reminder</SelectItem>
                    <SelectItem value="attendance_alert">Attendance Alert</SelectItem>
                    <SelectItem value="exam_notification">Exam Notification</SelectItem>
                    <SelectItem value="assignment_due">Assignment Due</SelectItem>
                    <SelectItem value="disciplinary">Disciplinary</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message *</Label>
              <Textarea
                id="message"
                value={notificationForm.message}
                onChange={(e) => setNotificationForm({ ...notificationForm, message: e.target.value })}
                placeholder="Enter your message here..."
                rows={4}
                maxLength={500}
              />
              <div className="text-xs text-muted-foreground">
                {notificationForm.message.length}/500 characters
              </div>
            </div>

            {/* Recipients and Priority */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="recipient_type">Recipients</Label>
                <Select
                  value={notificationForm.recipient_type}
                  onValueChange={(value) => setNotificationForm({ ...notificationForm, recipient_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_users">All Users</SelectItem>
                    <SelectItem value="students">Students Only</SelectItem>
                    <SelectItem value="parents">Parents Only</SelectItem>
                    <SelectItem value="teachers">Teachers Only</SelectItem>
                    <SelectItem value="admins">Administrators Only</SelectItem>
                    <SelectItem value="branch_users">Branch Users</SelectItem>
                    <SelectItem value="class_users">Class Users</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={notificationForm.priority}
                  onValueChange={(value) => setNotificationForm({ ...notificationForm, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Delivery Channels */}
            <div className="space-y-3">
              <Label>Delivery Channels</Label>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  { id: 'in_app', label: 'In-App Notification', icon: 'in_app' },
                  { id: 'email', label: 'Email', icon: 'email' },
                  { id: 'sms', label: 'SMS', icon: 'sms' },
                  { id: 'push', label: 'Push Notification', icon: 'push' },
                ].map((channel) => (
                  <div key={channel.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={channel.id}
                      checked={notificationForm.channels.includes(channel.id)}
                      onCheckedChange={(checked) => handleChannelChange(channel.id, checked as boolean)}
                    />
                    <Label htmlFor={channel.id} className="flex items-center space-x-2 cursor-pointer">
                      {getChannelIcon(channel.icon)}
                      <span>{channel.label}</span>
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Scheduling */}
            {isScheduled && (
              <div className="space-y-2">
                <Label htmlFor="scheduled_for">Schedule For</Label>
                <DateTimePicker
                  date={notificationForm.scheduled_for}
                  onDateChange={(date) => setNotificationForm({ ...notificationForm, scheduled_for: date })}
                />
              </div>
            )}

            {/* Action Button */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="action_url">Action URL (Optional)</Label>
                <Input
                  id="action_url"
                  value={notificationForm.action_url}
                  onChange={(e) => setNotificationForm({ ...notificationForm, action_url: e.target.value })}
                  placeholder="https://example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="action_text">Action Button Text</Label>
                <Input
                  id="action_text"
                  value={notificationForm.action_text}
                  onChange={(e) => setNotificationForm({ ...notificationForm, action_text: e.target.value })}
                  placeholder="View Details"
                  disabled={!notificationForm.action_url}
                />
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-3">
              <Label>Tags (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add tag"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                />
                <Button type="button" variant="outline" onClick={addTag}>
                  Add
                </Button>
              </div>
              {notificationForm.tags.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {notificationForm.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                      {tag} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={createNotificationMutation.isPending}
                className="flex-1"
              >
                {createNotificationMutation.isPending ? 'Sending...' : isScheduled ? 'Schedule Notification' : 'Send Notification'}
                <Send className="h-4 w-4 ml-2" />
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setNotificationForm({
                    title: '',
                    message: '',
                    notification_type: 'announcement',
                    priority: 'medium',
                    recipient_type: 'all_users',
                    channels: ['in_app'],
                    scheduled_for: null,
                    action_url: '',
                    action_text: '',
                    tags: [],
                  });
                  setIsScheduled(false);
                }}
              >
                Clear Form
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Preview */}
      {(notificationForm.title || notificationForm.message) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Eye className="h-5 w-5 mr-2" />
              Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 border rounded-lg bg-gray-50">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 p-2 bg-blue-100 rounded-full">
                  <Bell className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{notificationForm.title || 'Notification Title'}</h4>
                  <p className="text-sm text-gray-600 mt-1">{notificationForm.message || 'Notification message will appear here...'}</p>
                  {notificationForm.action_url && notificationForm.action_text && (
                    <div className="mt-2">
                      <Button variant="outline" size="sm" disabled>
                        {notificationForm.action_text}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};