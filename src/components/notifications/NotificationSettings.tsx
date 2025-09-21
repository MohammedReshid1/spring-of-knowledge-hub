import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Settings, 
  Bell, 
  Mail, 
  Smartphone,
  Clock,
  Volume2,
  Shield
} from 'lucide-react';
import { toast } from 'sonner';

interface NotificationPreferences {
  id?: string;
  user_id: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  whatsapp_enabled: boolean;
  in_app_enabled: boolean;
  announcements: boolean;
  emergency: boolean;
  events: boolean;
  academic: boolean;
  payment_reminders: boolean;
  attendance_alerts: boolean;
  exam_notifications: boolean;
  assignment_due: boolean;
  disciplinary: boolean;
  system: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  weekend_notifications: boolean;
  daily_digest: boolean;
  weekly_digest: boolean;
  digest_time: string;
}

export const NotificationSettings: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery<NotificationPreferences>({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const response = await apiClient.get('/notifications/preferences');
      return response.data;
    },
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: NotificationPreferences) => {
      const response = await apiClient.put('/notifications/preferences', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Notification preferences updated successfully');
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update preferences');
    },
  });

  const handlePreferenceChange = (field: keyof NotificationPreferences, value: any) => {
    if (!preferences) return;
    
    const updatedPreferences = { ...preferences, [field]: value };
    updatePreferencesMutation.mutate(updatedPreferences);
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading notification settings...</div>;
  }

  if (!preferences) {
    return <div className="text-center py-8">Failed to load preferences</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Notification Settings</h2>
        <p className="text-muted-foreground">Customize how and when you receive notifications</p>
      </div>

      {/* Delivery Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Bell className="h-5 w-5 mr-2" />
            Delivery Channels
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Bell className="h-4 w-4 text-blue-600" />
              <div>
                <Label htmlFor="in_app_enabled">In-App Notifications</Label>
                <p className="text-sm text-muted-foreground">Show notifications within the application</p>
              </div>
            </div>
            <Switch
              id="in_app_enabled"
              checked={preferences.in_app_enabled}
              onCheckedChange={(checked) => handlePreferenceChange('in_app_enabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Mail className="h-4 w-4 text-green-600" />
              <div>
                <Label htmlFor="email_enabled">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive notifications via email</p>
              </div>
            </div>
            <Switch
              id="email_enabled"
              checked={preferences.email_enabled}
              onCheckedChange={(checked) => handlePreferenceChange('email_enabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Smartphone className="h-4 w-4 text-purple-600" />
              <div>
                <Label htmlFor="sms_enabled">SMS Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive important alerts via SMS</p>
              </div>
            </div>
            <Switch
              id="sms_enabled"
              checked={preferences.sms_enabled}
              onCheckedChange={(checked) => handlePreferenceChange('sms_enabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Volume2 className="h-4 w-4 text-orange-600" />
              <div>
                <Label htmlFor="push_enabled">Push Notifications</Label>
                <p className="text-sm text-muted-foreground">Browser and mobile push notifications</p>
              </div>
            </div>
            <Switch
              id="push_enabled"
              checked={preferences.push_enabled}
              onCheckedChange={(checked) => handlePreferenceChange('push_enabled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Types */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Notification Types
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'announcements', label: 'General Announcements', description: 'School-wide announcements and updates' },
            { key: 'emergency', label: 'Emergency Alerts', description: 'Critical and urgent notifications', locked: true },
            { key: 'events', label: 'Events & Activities', description: 'School events, meetings, and activities' },
            { key: 'academic', label: 'Academic Updates', description: 'Grades, assignments, and academic progress' },
            { key: 'payment_reminders', label: 'Payment Reminders', description: 'Fee payment due dates and reminders' },
            { key: 'attendance_alerts', label: 'Attendance Alerts', description: 'Attendance-related notifications' },
            { key: 'exam_notifications', label: 'Exam Notifications', description: 'Exam schedules and results' },
            { key: 'assignment_due', label: 'Assignment Due', description: 'Assignment deadlines and submissions' },
            { key: 'disciplinary', label: 'Disciplinary Actions', description: 'Behavioral incidents and actions' },
            { key: 'system', label: 'System Notifications', description: 'Technical updates and maintenance' },
          ].map((type) => (
            <div key={type.key} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {type.locked && <Shield className="h-4 w-4 text-red-600" />}
                <div>
                  <Label htmlFor={type.key}>{type.label}</Label>
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                </div>
              </div>
              <Switch
                id={type.key}
                checked={preferences[type.key as keyof NotificationPreferences] as boolean}
                onCheckedChange={(checked) => handlePreferenceChange(type.key as keyof NotificationPreferences, checked)}
                disabled={type.locked}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Timing Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            Timing Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quiet_hours_start">Quiet Hours Start</Label>
              <Input
                id="quiet_hours_start"
                type="time"
                value={preferences.quiet_hours_start}
                onChange={(e) => handlePreferenceChange('quiet_hours_start', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quiet_hours_end">Quiet Hours End</Label>
              <Input
                id="quiet_hours_end"
                type="time"
                value={preferences.quiet_hours_end}
                onChange={(e) => handlePreferenceChange('quiet_hours_end', e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="weekend_notifications">Weekend Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive notifications on weekends</p>
            </div>
            <Switch
              id="weekend_notifications"
              checked={preferences.weekend_notifications}
              onCheckedChange={(checked) => handlePreferenceChange('weekend_notifications', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Digest Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Mail className="h-5 w-5 mr-2" />
            Digest Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="daily_digest">Daily Digest</Label>
              <p className="text-sm text-muted-foreground">Receive a daily summary of notifications</p>
            </div>
            <Switch
              id="daily_digest"
              checked={preferences.daily_digest}
              onCheckedChange={(checked) => handlePreferenceChange('daily_digest', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="weekly_digest">Weekly Digest</Label>
              <p className="text-sm text-muted-foreground">Receive a weekly summary of important updates</p>
            </div>
            <Switch
              id="weekly_digest"
              checked={preferences.weekly_digest}
              onCheckedChange={(checked) => handlePreferenceChange('weekly_digest', checked)}
            />
          </div>

          {(preferences.daily_digest || preferences.weekly_digest) && (
            <div className="space-y-2">
              <Label htmlFor="digest_time">Digest Delivery Time</Label>
              <Input
                id="digest_time"
                type="time"
                value={preferences.digest_time}
                onChange={(e) => handlePreferenceChange('digest_time', e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status */}
      {updatePreferencesMutation.isPending && (
        <Card>
          <CardContent className="text-center py-4">
            <p className="text-sm text-muted-foreground">Updating preferences...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};