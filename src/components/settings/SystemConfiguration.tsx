import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  Globe, 
  Mail, 
  Database, 
  Clock, 
  Bell, 
  Palette,
  Languages,
  FileText,
  Shield,
  Save,
  RefreshCw,
  BarChart3
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useRoleAccess } from '@/hooks/useRoleAccess';

interface SystemSettings {
  // General Settings
  school_name: string;
  school_address: string;
  school_phone: string;
  school_email: string;
  school_website?: string;
  academic_year: string;
  
  // System Settings
  default_language: string;
  timezone: string;
  date_format: string;
  currency: string;
  
  // Security Settings
  session_timeout_minutes: number;
  password_min_length: number;
  require_password_complexity: boolean;
  enable_two_factor_auth: boolean;
  max_login_attempts: number;
  
  // Backup Settings
  auto_backup_enabled: boolean;
  backup_frequency_days: number;
  backup_retention_days: number;
  
  // Notification Settings
  email_notifications_enabled: boolean;
  sms_notifications_enabled: boolean;
  push_notifications_enabled: boolean;
  notification_digest_enabled: boolean;
  
  // Academic Settings
  enable_grade_transitions: boolean;
  enable_parent_portal: boolean;
  enable_student_portal: boolean;
  enable_teacher_portal: boolean;
  
  // System Limits
  max_students_per_class: number;
  max_classes_per_teacher: number;
  max_file_upload_size_mb: number;
  
  // UI Settings
  theme_color: string;
  enable_dark_mode: boolean;
  show_system_stats: boolean;
}

const defaultSettings: SystemSettings = {
  school_name: 'Spring of Knowledge Academy',
  school_address: '',
  school_phone: '',
  school_email: '',
  school_website: '',
  academic_year: new Date().getFullYear().toString(),
  default_language: 'en',
  timezone: 'UTC',
  date_format: 'DD/MM/YYYY',
  currency: 'USD',
  session_timeout_minutes: 480, // 8 hours
  password_min_length: 6,
  require_password_complexity: true,
  enable_two_factor_auth: false,
  max_login_attempts: 5,
  auto_backup_enabled: true,
  backup_frequency_days: 7,
  backup_retention_days: 180,
  email_notifications_enabled: true,
  sms_notifications_enabled: false,
  push_notifications_enabled: true,
  notification_digest_enabled: true,
  enable_grade_transitions: true,
  enable_parent_portal: true,
  enable_student_portal: false,
  enable_teacher_portal: true,
  max_students_per_class: 50,
  max_classes_per_teacher: 10,
  max_file_upload_size_mb: 10,
  theme_color: '#0066cc',
  enable_dark_mode: false,
  show_system_stats: true
};

export const SystemConfiguration = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isSuperAdmin, isAdmin } = useRoleAccess();
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch system settings
  const { data: systemSettings, isLoading } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      // Since we don't have a specific API endpoint for system settings yet,
      // we'll use local storage for now and return default settings
      const savedSettings = localStorage.getItem('system-settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...defaultSettings, ...parsed });
        return { ...defaultSettings, ...parsed };
      }
      setSettings(defaultSettings);
      return defaultSettings;
    }
  });

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (newSettings: SystemSettings) => {
      // For now, save to localStorage. In a real implementation, this would be an API call
      localStorage.setItem('system-settings', JSON.stringify(newSettings));
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      return newSettings;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "System settings saved successfully.",
      });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings.",
        variant: "destructive",
      });
    }
  });

  const updateSetting = (key: keyof SystemSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveSettingsMutation.mutate(settings);
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    setHasChanges(true);
  };

  if (!isAdmin && !isSuperAdmin) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
            <p className="text-gray-600">
              You don't have permission to access system configuration.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Loading system configuration...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with save button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            System Configuration
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure global system settings and preferences
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
              Unsaved changes
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={saveSettingsMutation.isPending}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveSettingsMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {saveSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>

      {/* School Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            School Information
          </CardTitle>
          <CardDescription>
            Basic information about your institution
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="school_name">School Name</Label>
              <Input
                id="school_name"
                value={settings.school_name}
                onChange={(e) => updateSetting('school_name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="academic_year">Academic Year</Label>
              <Input
                id="academic_year"
                value={settings.academic_year}
                onChange={(e) => updateSetting('academic_year', e.target.value)}
                placeholder="2024-2025"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="school_address">School Address</Label>
            <Textarea
              id="school_address"
              value={settings.school_address}
              onChange={(e) => updateSetting('school_address', e.target.value)}
              rows={3}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="school_phone">Phone Number</Label>
              <Input
                id="school_phone"
                value={settings.school_phone}
                onChange={(e) => updateSetting('school_phone', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school_email">Email Address</Label>
              <Input
                id="school_email"
                type="email"
                value={settings.school_email}
                onChange={(e) => updateSetting('school_email', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school_website">Website (Optional)</Label>
              <Input
                id="school_website"
                type="url"
                value={settings.school_website || ''}
                onChange={(e) => updateSetting('school_website', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            System Settings
          </CardTitle>
          <CardDescription>
            Configure system behavior and localization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="default_language">Default Language</Label>
              <Select value={settings.default_language} onValueChange={(value) => updateSetting('default_language', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="ar">Arabic</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={settings.timezone} onValueChange={(value) => updateSetting('timezone', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="Africa/Cairo">Africa/Cairo</SelectItem>
                  <SelectItem value="Europe/London">Europe/London</SelectItem>
                  <SelectItem value="America/New_York">America/New_York</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="date_format">Date Format</Label>
              <Select value={settings.date_format} onValueChange={(value) => updateSetting('date_format', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select date format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={settings.currency} onValueChange={(value) => updateSetting('currency', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="EGP">EGP (£E)</SelectItem>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Settings
          </CardTitle>
          <CardDescription>
            Configure authentication and security policies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="session_timeout">Session Timeout (minutes)</Label>
              <Input
                id="session_timeout"
                type="number"
                value={settings.session_timeout_minutes}
                onChange={(e) => updateSetting('session_timeout_minutes', parseInt(e.target.value))}
                min="30"
                max="1440"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password_min_length">Minimum Password Length</Label>
              <Input
                id="password_min_length"
                type="number"
                value={settings.password_min_length}
                onChange={(e) => updateSetting('password_min_length', parseInt(e.target.value))}
                min="4"
                max="32"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="max_login_attempts">Max Login Attempts</Label>
              <Input
                id="max_login_attempts"
                type="number"
                value={settings.max_login_attempts}
                onChange={(e) => updateSetting('max_login_attempts', parseInt(e.target.value))}
                min="3"
                max="10"
              />
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require Password Complexity</Label>
                <p className="text-sm text-gray-500">
                  Require uppercase, lowercase, numbers, and special characters
                </p>
              </div>
              <Switch
                checked={settings.require_password_complexity}
                onCheckedChange={(checked) => updateSetting('require_password_complexity', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Two-Factor Authentication</Label>
                <p className="text-sm text-gray-500">
                  Require additional verification for login
                </p>
              </div>
              <Switch
                checked={settings.enable_two_factor_auth}
                onCheckedChange={(checked) => updateSetting('enable_two_factor_auth', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            System Limits
          </CardTitle>
          <CardDescription>
            Configure system capacity and resource limits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max_students_per_class">Max Students per Class</Label>
              <Input
                id="max_students_per_class"
                type="number"
                value={settings.max_students_per_class}
                onChange={(e) => updateSetting('max_students_per_class', parseInt(e.target.value))}
                min="1"
                max="100"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="max_classes_per_teacher">Max Classes per Teacher</Label>
              <Input
                id="max_classes_per_teacher"
                type="number"
                value={settings.max_classes_per_teacher}
                onChange={(e) => updateSetting('max_classes_per_teacher', parseInt(e.target.value))}
                min="1"
                max="20"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="max_file_upload_size">Max File Upload Size (MB)</Label>
              <Input
                id="max_file_upload_size"
                type="number"
                value={settings.max_file_upload_size_mb}
                onChange={(e) => updateSetting('max_file_upload_size_mb', parseInt(e.target.value))}
                min="1"
                max="100"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Feature Settings
          </CardTitle>
          <CardDescription>
            Enable or disable system features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Grade Transitions</Label>
                <p className="text-sm text-gray-500">
                  Allow automatic promotion of students to next grade
                </p>
              </div>
              <Switch
                checked={settings.enable_grade_transitions}
                onCheckedChange={(checked) => updateSetting('enable_grade_transitions', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Parent Portal</Label>
                <p className="text-sm text-gray-500">
                  Allow parents to access student information
                </p>
              </div>
              <Switch
                checked={settings.enable_parent_portal}
                onCheckedChange={(checked) => updateSetting('enable_parent_portal', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Student Portal</Label>
                <p className="text-sm text-gray-500">
                  Allow students to access their information
                </p>
              </div>
              <Switch
                checked={settings.enable_student_portal}
                onCheckedChange={(checked) => updateSetting('enable_student_portal', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Teacher Portal</Label>
                <p className="text-sm text-gray-500">
                  Allow teachers to manage their classes
                </p>
              </div>
              <Switch
                checked={settings.enable_teacher_portal}
                onCheckedChange={(checked) => updateSetting('enable_teacher_portal', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};