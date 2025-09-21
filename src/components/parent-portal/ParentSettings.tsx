import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { 
  Settings, 
  User, 
  Bell,
  Mail,
  Phone,
  Shield,
  Eye,
  EyeOff,
  Camera,
  Save,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ParentInfo {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  address?: string;
  relationship: string;
  children: Array<{
    id: string;
    student_id: string;
    full_name: string;
    grade_level: string;
    class_name: string;
  }>;
}

interface NotificationSettings {
  email_notifications: {
    academic_updates: boolean;
    attendance_alerts: boolean;
    behavior_reports: boolean;
    payment_reminders: boolean;
    school_announcements: boolean;
    emergency_alerts: boolean;
  };
  sms_notifications: {
    attendance_alerts: boolean;
    emergency_alerts: boolean;
    payment_reminders: boolean;
  };
  push_notifications: {
    all_notifications: boolean;
    important_only: boolean;
  };
  notification_schedule: {
    start_time: string;
    end_time: string;
    weekend_notifications: boolean;
  };
}

interface PrivacySettings {
  profile_visibility: 'public' | 'private' | 'teachers_only';
  allow_teacher_messages: boolean;
  allow_school_surveys: boolean;
  share_attendance_with_family: boolean;
  share_academic_progress_with_family: boolean;
  data_retention_consent: boolean;
}

interface SecuritySettings {
  two_factor_enabled: boolean;
  login_notifications: boolean;
  session_timeout: number;
  allowed_devices: Array<{
    id: string;
    device_name: string;
    last_login: string;
    is_current: boolean;
  }>;
}

export const ParentSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: parentInfo, isLoading: profileLoading } = useQuery<ParentInfo>({
    queryKey: ['parent-profile'],
    queryFn: async () => {
      const response = await apiClient.get('/communication/parent-info');
      return response.data;
    },
  });

  const { data: notificationSettings } = useQuery<NotificationSettings>({
    queryKey: ['notification-settings'],
    queryFn: async () => {
      const response = await apiClient.get('/communication/parent-settings/notifications');
      return response.data;
    },
  });

  const { data: privacySettings } = useQuery<PrivacySettings>({
    queryKey: ['privacy-settings'],
    queryFn: async () => {
      const response = await apiClient.get('/communication/parent-settings/privacy');
      return response.data;
    },
  });

  const { data: securitySettings } = useQuery<SecuritySettings>({
    queryKey: ['security-settings'],
    queryFn: async () => {
      const response = await apiClient.get('/communication/parent-settings/security');
      return response.data;
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: Partial<ParentInfo>) => {
      const response = await apiClient.put('/communication/parent-profile', profileData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-profile'] });
      toast({
        title: "Profile Updated",
        description: "Your profile information has been successfully updated.",
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateNotificationsMutation = useMutation({
    mutationFn: async (settings: Partial<NotificationSettings>) => {
      const response = await apiClient.put('/communication/parent-settings/notifications', settings);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
      toast({
        title: "Settings Updated",
        description: "Your notification preferences have been saved.",
      });
    },
  });

  const updatePrivacyMutation = useMutation({
    mutationFn: async (settings: Partial<PrivacySettings>) => {
      const response = await apiClient.put('/communication/parent-settings/privacy', settings);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['privacy-settings'] });
      toast({
        title: "Privacy Settings Updated",
        description: "Your privacy preferences have been saved.",
      });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async (passwordData: typeof passwordForm) => {
      const response = await apiClient.put('/communication/parent-settings/password', passwordData);
      return response.data;
    },
    onSuccess: () => {
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      toast({
        title: "Password Changed",
        description: "Your password has been successfully updated.",
      });
    },
    onError: () => {
      toast({
        title: "Password Change Failed",
        description: "Failed to change password. Please check your current password.",
        variant: "destructive",
      });
    },
  });

  const enableTwoFactorMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/communication/parent-settings/enable-2fa');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-settings'] });
      toast({
        title: "Two-Factor Authentication Enabled",
        description: "Two-factor authentication has been enabled for your account.",
      });
    },
  });

  const handleProfileUpdate = (field: keyof ParentInfo, value: string) => {
    if (parentInfo) {
      updateProfileMutation.mutate({ [field]: value });
    }
  };

  const handlePasswordChange = () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast({
        title: "Password Mismatch",
        description: "New password and confirmation do not match.",
        variant: "destructive",
      });
      return;
    }
    
    if (passwordForm.new_password.length < 8) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    updatePasswordMutation.mutate(passwordForm);
  };

  if (profileLoading) {
    return <div className="text-center py-8">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-muted-foreground">Manage your account preferences and privacy settings</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Profile Picture */}
                <div className="flex items-center space-x-4">
                  <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                    {parentInfo?.full_name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <h3 className="font-medium">{parentInfo?.full_name}</h3>
                    <p className="text-sm text-muted-foreground">{parentInfo?.relationship}</p>
                    <Button variant="outline" size="sm" className="mt-2">
                      <Camera className="h-4 w-4 mr-2" />
                      Change Photo
                    </Button>
                  </div>
                </div>

                {/* Profile Fields */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input
                      id="full_name"
                      defaultValue={parentInfo?.full_name}
                      onBlur={(e) => handleProfileUpdate('full_name', e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      defaultValue={parentInfo?.email}
                      onBlur={(e) => handleProfileUpdate('email', e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      defaultValue={parentInfo?.phone}
                      onBlur={(e) => handleProfileUpdate('phone', e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="relationship">Relationship to Student</Label>
                    <Select defaultValue={parentInfo?.relationship}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="parent">Parent</SelectItem>
                        <SelectItem value="guardian">Guardian</SelectItem>
                        <SelectItem value="grandparent">Grandparent</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    defaultValue={parentInfo?.address}
                    onBlur={(e) => handleProfileUpdate('address', e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Children Information */}
                <div>
                  <h4 className="font-medium mb-3">Your Children</h4>
                  <div className="space-y-2">
                    {parentInfo?.children?.map((child) => (
                      <div key={child.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <div>
                          <p className="font-medium">{child.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {child.grade_level} - {child.class_name} (ID: {child.student_id})
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          {/* Email Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="h-5 w-5 mr-2" />
                Email Notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {notificationSettings && Object.entries(notificationSettings.email_notifications).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <Label htmlFor={key} className="font-medium">
                        {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Receive email notifications for {key.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <Switch
                      id={key}
                      checked={value}
                      onCheckedChange={(checked) => {
                        updateNotificationsMutation.mutate({
                          email_notifications: {
                            ...notificationSettings.email_notifications,
                            [key]: checked,
                          },
                        });
                      }}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* SMS Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Phone className="h-5 w-5 mr-2" />
                SMS Notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {notificationSettings && Object.entries(notificationSettings.sms_notifications).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <Label htmlFor={`sms_${key}`} className="font-medium">
                        {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Receive SMS alerts for {key.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <Switch
                      id={`sms_${key}`}
                      checked={value}
                      onCheckedChange={(checked) => {
                        updateNotificationsMutation.mutate({
                          sms_notifications: {
                            ...notificationSettings.sms_notifications,
                            [key]: checked,
                          },
                        });
                      }}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Notification Schedule */}
          <Card>
            <CardHeader>
              <CardTitle>Notification Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="start_time">Start Time</Label>
                    <Input
                      id="start_time"
                      type="time"
                      defaultValue={notificationSettings?.notification_schedule.start_time}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_time">End Time</Label>
                    <Input
                      id="end_time"
                      type="time"
                      defaultValue={notificationSettings?.notification_schedule.end_time}
                    />
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="weekend_notifications" className="font-medium">
                      Weekend Notifications
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications during weekends
                    </p>
                  </div>
                  <Switch
                    id="weekend_notifications"
                    checked={notificationSettings?.notification_schedule.weekend_notifications}
                    onCheckedChange={(checked) => {
                      updateNotificationsMutation.mutate({
                        notification_schedule: {
                          ...notificationSettings?.notification_schedule,
                          weekend_notifications: checked,
                        },
                      });
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Privacy Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <Label htmlFor="profile_visibility">Profile Visibility</Label>
                  <Select 
                    defaultValue={privacySettings?.profile_visibility}
                    onValueChange={(value) => {
                      updatePrivacyMutation.mutate({ profile_visibility: value as any });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="teachers_only">Teachers Only</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground mt-1">
                    Control who can see your profile information
                  </p>
                </div>

                {privacySettings && Object.entries(privacySettings)
                  .filter(([key]) => key !== 'profile_visibility')
                  .map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <div>
                        <Label htmlFor={key} className="font-medium">
                          {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {key === 'allow_teacher_messages' && 'Allow teachers to send direct messages'}
                          {key === 'allow_school_surveys' && 'Participate in school surveys and feedback'}
                          {key === 'share_attendance_with_family' && 'Share attendance data with family members'}
                          {key === 'share_academic_progress_with_family' && 'Share academic progress with family members'}
                          {key === 'data_retention_consent' && 'Consent to data retention for improved services'}
                        </p>
                      </div>
                      <Switch
                        id={key}
                        checked={Boolean(value)}
                        onCheckedChange={(checked) => {
                          updatePrivacyMutation.mutate({ [key]: checked });
                        }}
                      />
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          {/* Password Change */}
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="current_password">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current_password"
                      type={showCurrentPassword ? "text" : "password"}
                      value={passwordForm.current_password}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, current_password: e.target.value }))}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="new_password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new_password"
                      type={showNewPassword ? "text" : "password"}
                      value={passwordForm.new_password}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, new_password: e.target.value }))}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="confirm_password">Confirm New Password</Label>
                  <Input
                    id="confirm_password"
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm_password: e.target.value }))}
                  />
                </div>

                <Button 
                  onClick={handlePasswordChange}
                  disabled={updatePasswordMutation.isPending || !passwordForm.current_password || !passwordForm.new_password}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Two-Factor Authentication */}
          <Card>
            <CardHeader>
              <CardTitle>Two-Factor Authentication</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Two-Factor Authentication</p>
                    <p className="text-sm text-muted-foreground">
                      Add an extra layer of security to your account
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {securitySettings?.two_factor_enabled ? (
                      <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-800">Disabled</Badge>
                    )}
                  </div>
                </div>

                {!securitySettings?.two_factor_enabled && (
                  <Button onClick={() => enableTwoFactorMutation.mutate()}>
                    <Shield className="h-4 w-4 mr-2" />
                    Enable Two-Factor Authentication
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Login Sessions */}
          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              {securitySettings?.allowed_devices ? (
                <div className="space-y-3">
                  {securitySettings.allowed_devices.map((device) => (
                    <div key={device.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div>
                        <p className="font-medium">{device.device_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Last login: {new Date(device.last_login).toLocaleString()}
                          {device.is_current && ' (Current session)'}
                        </p>
                      </div>
                      {!device.is_current && (
                        <Button variant="outline" size="sm">
                          Revoke
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No active sessions found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};