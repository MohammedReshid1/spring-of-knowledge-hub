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
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import { useAcademicYear, getAcademicYearString } from '@/hooks/useAcademicYear';

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
  const academicYearQuery = useAcademicYear();
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
    <>
      {/* Premium Animation Styles */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes pulseGlow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
          }
          50% {
            box-shadow: 0 0 30px rgba(59, 130, 246, 0.5);
          }
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out;
        }

        .animate-slideInRight {
          animation: slideInRight 0.6s ease-out;
        }

        .animate-pulseGlow {
          animation: pulseGlow 2s infinite;
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        {/* Premium Header Section */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 pb-20 pt-16">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }} />
          </div>

          {/* Floating Shapes */}
          <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full animate-pulse" />
          <div className="absolute top-20 right-20 w-16 h-16 bg-white/10 rounded-full animate-pulse delay-1000" />
          <div className="absolute bottom-20 left-1/3 w-12 h-12 bg-white/10 rounded-full animate-pulse delay-500" />

          <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-8 inline-flex items-center rounded-full bg-white/10 backdrop-blur-sm px-6 py-2 text-sm font-medium text-white/90 ring-1 ring-white/20">
                <Settings className="mr-2 h-4 w-4" />
                System Administration
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
                System <span className="bg-gradient-to-r from-blue-200 to-cyan-200 bg-clip-text text-transparent">Configuration</span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-blue-100">
                Configure global system settings, security policies, and administrative preferences.
                Maintain optimal system performance with comprehensive controls.
              </p>
            </div>

            {/* Action buttons moved to content area */}
            {hasChanges && (
              <div className="mt-8 text-center">
                <div className="inline-flex items-center gap-3">
                  <div className="bg-yellow-100/20 backdrop-blur-sm border border-yellow-200/30 text-yellow-100 px-4 py-2 rounded-lg text-sm font-medium">
                    Unsaved Changes
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    disabled={saveSettingsMutation.isPending}
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={!hasChanges || saveSettingsMutation.isPending}
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm animate-pulseGlow"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saveSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Wave */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg className="w-full h-20 fill-current text-slate-50" viewBox="0 0 1440 120" preserveAspectRatio="none">
              <path d="M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z" />
            </svg>
          </div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 -mt-10 space-y-8 px-6 pb-16">
          <div className="mx-auto max-w-7xl">

          {/* School Information */}
          <Card className="bg-white/90 backdrop-blur-glass rounded-3xl border border-white/20 shadow-premium-xl animate-fadeInUp">
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
              <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-gray-700 font-medium">
                {getAcademicYearString(academicYearQuery)}
              </div>
              <p className="text-xs text-gray-500">
                Managed through Academic Calendar. Read-only display.
              </p>
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
        </div>
      </div>
    </>
  );
};