import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Bell, 
  Mail, 
  MessageSquare, 
  Smartphone,
  Clock,
  Volume2,
  VolumeX,
  Settings,
  Save,
  RotateCcw,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

interface NotificationPreferences {
  id?: string;
  user_id: string;
  
  // Channel Preferences
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  whatsapp_enabled: boolean;
  in_app_enabled: boolean;
  
  // Type Preferences
  announcements: boolean;
  emergency: boolean;
  events: boolean;
  academic: boolean;
  payment_reminders: boolean;
  attendance_alerts: boolean;
  exam_notifications: boolean;
  assignment_due: boolean;
  disciplinary: boolean;
  transport: boolean;
  library: boolean;
  system: boolean;
  
  // Time Preferences
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  weekend_notifications: boolean;
  
  // Digest Settings
  daily_digest: boolean;
  weekly_digest: boolean;
  digest_time: string;
}

interface NotificationPreferencesProps {
  userId: string;
  userRole: string;
}

const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({ 
  userId, 
  userRole 
}) => {
  const queryClient = useQueryClient();
  
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    user_id: userId,
    email_enabled: true,
    sms_enabled: true,
    push_enabled: true,
    whatsapp_enabled: false,
    in_app_enabled: true,
    announcements: true,
    emergency: true,
    events: true,
    academic: true,
    payment_reminders: true,
    attendance_alerts: true,
    exam_notifications: true,
    assignment_due: true,
    disciplinary: true,
    transport: true,
    library: true,
    system: false,
    quiet_hours_start: "22:00",
    quiet_hours_end: "07:00",
    weekend_notifications: false,
    daily_digest: false,
    weekly_digest: false,
    digest_time: "09:00"
  });
  
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Get notification preferences
  const { data: currentPreferences, isLoading } = useQuery({
    queryKey: ['notification-preferences', userId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/notifications/preferences/${userId}`);
      return response.data;
    }
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (prefs: NotificationPreferences) => {
      const response = await apiClient.put(`/api/notifications/preferences/${userId}`, prefs);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      setHasChanges(false);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    },
    onError: () => {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  });

  // Initialize preferences when data loads
  useEffect(() => {
    if (currentPreferences) {
      setPreferences(currentPreferences);
    }
  }, [currentPreferences]);

  const handlePreferenceChange = (field: keyof NotificationPreferences, value: any) => {
    setPreferences(prev => ({
      ...prev,
      [field]: value
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    setSaveStatus('saving');
    updatePreferencesMutation.mutate(preferences);
  };

  const handleReset = () => {
    if (currentPreferences) {
      setPreferences(currentPreferences);
      setHasChanges(false);
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'sms': return <MessageSquare className="h-4 w-4" />;
      case 'push': return <Smartphone className="h-4 w-4" />;
      case 'in_app': return <Bell className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationTypeInfo = (type: string) => {
    const typeInfo = {
      announcements: { label: 'General Announcements', description: 'School-wide announcements and news', priority: 'medium' },
      emergency: { label: 'Emergency Alerts', description: 'Critical safety and emergency notifications', priority: 'urgent' },
      events: { label: 'School Events', description: 'Sports, cultural events, and special activities', priority: 'medium' },
      academic: { label: 'Academic Updates', description: 'Grades, report cards, and academic progress', priority: 'high' },
      payment_reminders: { label: 'Fee Reminders', description: 'Fee due dates and payment confirmations', priority: 'high' },
      attendance_alerts: { label: 'Attendance Alerts', description: 'Absence notifications and attendance warnings', priority: 'high' },
      exam_notifications: { label: 'Exam Notifications', description: 'Exam schedules, reminders, and results', priority: 'high' },
      assignment_due: { label: 'Assignment Reminders', description: 'Homework and assignment due dates', priority: 'medium' },
      disciplinary: { label: 'Disciplinary Notices', description: 'Behavior reports and disciplinary actions', priority: 'high' },
      transport: { label: 'Transport Updates', description: 'Bus schedules and route changes', priority: 'medium' },
      library: { label: 'Library Notices', description: 'Book due dates and library events', priority: 'low' },
      system: { label: 'System Notifications', description: 'Technical updates and maintenance notices', priority: 'low' }
    };
    
    return typeInfo[type] || { label: type, description: '', priority: 'medium' };
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Save Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Notification Preferences</h2>
        </div>
        
        <div className="flex items-center gap-2">
          {saveStatus === 'saved' && (
            <div className="flex items-center gap-1 text-green-600 text-sm">
              <CheckCircle className="h-4 w-4" />
              Saved
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="flex items-center gap-1 text-red-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              Error saving
            </div>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!hasChanges || saveStatus === 'saving'}
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset
          </Button>
          
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveStatus === 'saving'}
            size="sm"
          >
            <Save className="h-4 w-4 mr-1" />
            {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="channels" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="types">Notification Types</TabsTrigger>
          <TabsTrigger value="timing">Timing</TabsTrigger>
          <TabsTrigger value="digest">Digest</TabsTrigger>
        </TabsList>

        {/* Delivery Channels */}
        <TabsContent value="channels" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Delivery Channels
              </CardTitle>
              <p className="text-sm text-gray-600">
                Choose how you want to receive notifications
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* In-App Notifications */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getChannelIcon('in_app')}
                  <div>
                    <Label className="text-base font-medium">In-App Notifications</Label>
                    <p className="text-sm text-gray-600">
                      Notifications within the application
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.in_app_enabled}
                  onCheckedChange={(checked) => handlePreferenceChange('in_app_enabled', checked)}
                />
              </div>

              {/* Email */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getChannelIcon('email')}
                  <div>
                    <Label className="text-base font-medium">Email Notifications</Label>
                    <p className="text-sm text-gray-600">
                      Notifications sent to your email address
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.email_enabled}
                  onCheckedChange={(checked) => handlePreferenceChange('email_enabled', checked)}
                />
              </div>

              {/* SMS */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getChannelIcon('sms')}
                  <div>
                    <Label className="text-base font-medium">SMS Notifications</Label>
                    <p className="text-sm text-gray-600">
                      Text messages to your mobile phone
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.sms_enabled}
                  onCheckedChange={(checked) => handlePreferenceChange('sms_enabled', checked)}
                />
              </div>

              {/* Push Notifications */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getChannelIcon('push')}
                  <div>
                    <Label className="text-base font-medium">Push Notifications</Label>
                    <p className="text-sm text-gray-600">
                      Browser and mobile app notifications
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.push_enabled}
                  onCheckedChange={(checked) => handlePreferenceChange('push_enabled', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Types */}
        <TabsContent value="types" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Types</CardTitle>
              <p className="text-sm text-gray-600">
                Control which types of notifications you want to receive
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(preferences)
                .filter(([key, value]) => 
                  typeof value === 'boolean' && 
                  !['email_enabled', 'sms_enabled', 'push_enabled', 'whatsapp_enabled', 'in_app_enabled', 'weekend_notifications', 'daily_digest', 'weekly_digest'].includes(key)
                )
                .map(([key, value]) => {
                  const typeInfo = getNotificationTypeInfo(key);
                  return (
                    <div key={key} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Label className="text-base font-medium">{typeInfo.label}</Label>
                          <Badge className={getPriorityColor(typeInfo.priority)}>
                            {typeInfo.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{typeInfo.description}</p>
                      </div>
                      <Switch
                        checked={value as boolean}
                        onCheckedChange={(checked) => handlePreferenceChange(key as keyof NotificationPreferences, checked)}
                      />
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timing Preferences */}
        <TabsContent value="timing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Timing Preferences
              </CardTitle>
              <p className="text-sm text-gray-600">
                Configure when you want to receive notifications
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Quiet Hours */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Quiet Hours</Label>
                <p className="text-sm text-gray-600 -mt-2">
                  You won't receive non-urgent notifications during these hours
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">Start Time</Label>
                    <Input
                      type="time"
                      value={preferences.quiet_hours_start || "22:00"}
                      onChange={(e) => handlePreferenceChange('quiet_hours_start', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">End Time</Label>
                    <Input
                      type="time"
                      value={preferences.quiet_hours_end || "07:00"}
                      onChange={(e) => handlePreferenceChange('quiet_hours_end', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Weekend Notifications */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">Weekend Notifications</Label>
                  <p className="text-sm text-gray-600">
                    Receive notifications on weekends
                  </p>
                </div>
                <Switch
                  checked={preferences.weekend_notifications}
                  onCheckedChange={(checked) => handlePreferenceChange('weekend_notifications', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Digest Settings */}
        <TabsContent value="digest" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Digest Settings</CardTitle>
              <p className="text-sm text-gray-600">
                Receive summary notifications instead of individual alerts
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Daily Digest */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">Daily Digest</Label>
                  <p className="text-sm text-gray-600">
                    Daily summary of all notifications
                  </p>
                </div>
                <Switch
                  checked={preferences.daily_digest}
                  onCheckedChange={(checked) => handlePreferenceChange('daily_digest', checked)}
                />
              </div>

              {/* Weekly Digest */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">Weekly Digest</Label>
                  <p className="text-sm text-gray-600">
                    Weekly summary of important notifications
                  </p>
                </div>
                <Switch
                  checked={preferences.weekly_digest}
                  onCheckedChange={(checked) => handlePreferenceChange('weekly_digest', checked)}
                />
              </div>

              {/* Digest Time */}
              {(preferences.daily_digest || preferences.weekly_digest) && (
                <div className="space-y-2">
                  <Label className="text-sm">Digest Delivery Time</Label>
                  <Input
                    type="time"
                    value={preferences.digest_time}
                    onChange={(e) => handlePreferenceChange('digest_time', e.target.value)}
                    className="w-48"
                  />
                  <p className="text-xs text-gray-500">
                    Time when you want to receive digest notifications
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      {hasChanges && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You have unsaved changes. Don't forget to save your preferences.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default NotificationPreferences;