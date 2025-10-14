import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, School, Calendar, Globe, DollarSign, Shield, Info } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAcademicYear, getAcademicYearString } from '@/hooks/useAcademicYear';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export const AccountSettings = () => {
  // Get current academic year from backend
  const academicYearQuery = useAcademicYear();
  const currentAcademicYear = getAcademicYearString(academicYearQuery);
  const queryClient = useQueryClient();

  // Fetch system settings from backend
  const { data: systemSettings, isLoading } = useSystemSettings();

  // Update system settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: { currency?: string; language?: string }) => {
      const response = await apiClient.put('/system-settings/', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      toast({
        title: "Success",
        description: "Settings updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      });
    }
  });

  const handleSystemSettingsChange = (field: string, value: string) => {
    if (field === 'currency') {
      updateSettingsMutation.mutate({ currency: value });
    } else if (field === 'language') {
      updateSettingsMutation.mutate({ language: value });
    }
  };

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
            box-shadow: 0 0 20px rgba(16, 185, 129, 0.3);
          }
          50% {
            box-shadow: 0 0 30px rgba(16, 185, 129, 0.5);
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

      <div className="space-y-8 animate-fadeInUp">
        {/* Premium Settings Header */}
        <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/95 via-white/80 to-emerald-50/50 border border-white/30 shadow-premium hover:shadow-glow-green transition-all duration-500">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="relative">
            <CardTitle className="text-2xl font-bold flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-lg group-hover:blur-xl transition-all duration-300" />
                <Settings className="relative h-6 w-6 text-emerald-600" />
              </div>
              <span className="bg-gradient-to-r from-slate-700 via-emerald-600 to-green-600 bg-clip-text text-transparent">
                System Configuration
              </span>
            </CardTitle>
            <p className="text-slate-600 leading-relaxed">Manage global system settings, currency preferences, and administrative configurations</p>
          </CardHeader>
        </Card>

        {/* Settings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* School Information Card */}
          <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/90 via-white/70 to-emerald-50/50 border border-white/20 shadow-premium hover:shadow-glow-green transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.02] via-green-500/[0.03] to-teal-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="relative pb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-lg group-hover:blur-xl transition-all duration-300" />
                  <School className="relative h-5 w-5 text-emerald-600" />
                </div>
                <CardTitle className="text-lg font-bold bg-gradient-to-r from-slate-700 to-emerald-600 bg-clip-text text-transparent">
                  School Information
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative space-y-6">
              <div className="space-y-3">
                <Label htmlFor="schoolName" className="text-sm font-semibold text-emerald-600/80 uppercase tracking-wider">Institution Name</Label>
                <div className="relative group/field">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-green-500/5 rounded-xl opacity-0 group-hover/field:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  <Input
                    id="schoolName"
                    value={systemSettings?.school_name || 'Spring of Knowledge Academy'}
                    disabled
                    className="h-12 bg-white/80 backdrop-blur-sm border-white/40 cursor-not-allowed text-slate-700 font-medium rounded-xl shadow-sm relative"
                    placeholder="Spring of Knowledge Academy"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <Shield className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Info className="h-3 w-3" />
                  <span>School name is fixed and cannot be changed</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Academic Year Card */}
          <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/90 via-white/70 to-blue-50/50 border border-white/20 shadow-premium hover:shadow-glow-blue transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.02] via-indigo-500/[0.03] to-purple-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="relative pb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-lg group-hover:blur-xl transition-all duration-300" />
                  <Calendar className="relative h-5 w-5 text-blue-600" />
                </div>
                <CardTitle className="text-lg font-bold bg-gradient-to-r from-slate-700 to-blue-600 bg-clip-text text-transparent">
                  Academic Calendar
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative space-y-6">
              <div className="space-y-3">
                <Label htmlFor="academicYear" className="text-sm font-semibold text-blue-600/80 uppercase tracking-wider">Current Academic Year</Label>
                <div className="relative group/field">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 rounded-xl opacity-0 group-hover/field:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  <Input
                    id="academicYear"
                    value={currentAcademicYear}
                    disabled
                    className="h-12 bg-white/80 backdrop-blur-sm border-white/40 cursor-not-allowed text-slate-700 font-medium rounded-xl shadow-sm relative"
                    placeholder={currentAcademicYear}
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Info className="h-3 w-3" />
                  <span>Academic year is managed by the system</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Currency Settings Card */}
          <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/90 via-white/70 to-amber-50/50 border border-white/20 shadow-premium hover:shadow-glow-orange transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.02] via-orange-500/[0.03] to-yellow-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="relative pb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-lg group-hover:blur-xl transition-all duration-300" />
                  <DollarSign className="relative h-5 w-5 text-amber-600" />
                </div>
                <CardTitle className="text-lg font-bold bg-gradient-to-r from-slate-700 to-amber-600 bg-clip-text text-transparent">
                  Currency Settings
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative space-y-6">
              <div className="space-y-3">
                <Label htmlFor="currency" className="text-sm font-semibold text-amber-600/80 uppercase tracking-wider">System Currency</Label>
                <div className="relative group/field">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-orange-500/5 rounded-xl opacity-0 group-hover/field:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  <Select
                    value={systemSettings?.currency || 'ETB'}
                    onValueChange={(value) => handleSystemSettingsChange('currency', value)}
                    disabled={isLoading || updateSettingsMutation.isPending}
                  >
                    <SelectTrigger className="h-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-amber-300/50 focus:border-amber-500/60 focus:ring-amber-500/20 focus:ring-4 transition-all duration-300 text-slate-700 rounded-xl shadow-sm hover:shadow-md">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent className="backdrop-blur-xl bg-white/95 border-white/40">
                      <SelectItem value="ETB" className="hover:bg-amber-50/80">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Ethiopian Birr (ETB)</span>
                          <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-200/50">Default</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="USD" className="hover:bg-amber-50/80">US Dollar ($)</SelectItem>
                      <SelectItem value="EUR" className="hover:bg-amber-50/80">Euro (€)</SelectItem>
                      <SelectItem value="GBP" className="hover:bg-amber-50/80">British Pound (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {updateSettingsMutation.isPending && (
                  <div className="flex items-center gap-2 text-xs text-amber-600">
                    <div className="w-3 h-3 border border-amber-600 border-t-transparent rounded-full animate-spin" />
                    <span>Updating currency...</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Language Settings Card */}
          <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/90 via-white/70 to-purple-50/50 border border-white/20 shadow-premium hover:shadow-glow-purple transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.02] via-indigo-500/[0.03] to-pink-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="relative pb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-lg group-hover:blur-xl transition-all duration-300" />
                  <Globe className="relative h-5 w-5 text-purple-600" />
                </div>
                <CardTitle className="text-lg font-bold bg-gradient-to-r from-slate-700 to-purple-600 bg-clip-text text-transparent">
                  Language & Region
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative space-y-6">
              <div className="space-y-3">
                <Label htmlFor="language" className="text-sm font-semibold text-purple-600/80 uppercase tracking-wider">System Language</Label>
                <div className="relative group/field">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-indigo-500/5 rounded-xl opacity-0 group-hover/field:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  <Select
                    value={systemSettings?.language || 'en'}
                    onValueChange={(value) => handleSystemSettingsChange('language', value)}
                    disabled={isLoading || updateSettingsMutation.isPending}
                  >
                    <SelectTrigger className="h-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-purple-300/50 focus:border-purple-500/60 focus:ring-purple-500/20 focus:ring-4 transition-all duration-300 text-slate-700 rounded-xl shadow-sm hover:shadow-md">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent className="backdrop-blur-xl bg-white/95 border-white/40">
                      <SelectItem value="en" className="hover:bg-purple-50/80">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">English</span>
                          <Badge variant="outline" className="text-xs bg-purple-100 text-purple-800 border-purple-200/50">Active</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="am" disabled className="hover:bg-purple-50/80 opacity-50 cursor-not-allowed">
                        <div className="flex items-center gap-2">
                          <span>Amharic</span>
                          <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600 border-gray-200/50">Coming Soon</Badge>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {updateSettingsMutation.isPending && (
                  <div className="flex items-center gap-2 text-xs text-purple-600">
                    <div className="w-3 h-3 border border-purple-600 border-t-transparent rounded-full animate-spin" />
                    <span>Updating language...</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Status Card */}
        <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/95 via-white/80 to-slate-50/50 border border-white/30 shadow-premium hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-500">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-500/[0.02] via-gray-500/[0.02] to-zinc-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="relative">
            <CardTitle className="text-xl font-bold flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-slate-500/20 rounded-full blur-lg group-hover:blur-xl transition-all duration-300" />
                <Shield className="relative h-5 w-5 text-slate-600" />
              </div>
              <span className="bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 bg-clip-text text-transparent">
                System Status
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-lg animate-pulse" />
                  <div className="relative w-12 h-12 bg-gradient-to-br from-emerald-100 to-green-100 rounded-full flex items-center justify-center border border-emerald-200/50">
                    <Settings className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-600/80 uppercase tracking-wider">Configuration</p>
                  <p className="text-lg font-bold text-slate-900">Active</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-lg animate-pulse" />
                  <div className="relative w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center border border-blue-200/50">
                    <Calendar className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-600/80 uppercase tracking-wider">Academic Year</p>
                  <p className="text-lg font-bold text-slate-900">{currentAcademicYear}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-lg animate-pulse" />
                  <div className="relative w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center border border-purple-200/50">
                    <Globe className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-purple-600/80 uppercase tracking-wider">Language</p>
                  <p className="text-lg font-bold text-slate-900">
                    {systemSettings?.language === 'en' ? 'English' : 'Amharic'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};
