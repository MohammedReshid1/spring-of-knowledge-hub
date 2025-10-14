import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Eye, EyeOff, Shield, Key } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';

export const AccountSecurity = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords don't match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await apiClient.changePassword(currentPassword, newPassword);

      if (response.data) {
        toast({
          title: "Success",
          description: "Password changed successfully!",
        });

        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error: any) {
      const errorDetail = error.response?.data?.detail || error.message || "Failed to change password";

      // Check if user has no password set
      if (errorDetail.includes("no password set")) {
        toast({
          title: "No Password Set",
          description: "Your account doesn't have a password. Please contact your administrator to set an initial password, or use the 'Forgot Password' feature on the login page.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: errorDetail,
          variant: "destructive",
        });
      }
    } finally {
      setIsChangingPassword(false);
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
        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out;
        }
      `}</style>

      <div className="space-y-6">
        {/* Premium Hero Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-red-600 via-rose-600 to-pink-700 rounded-2xl pb-16 pt-12">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-gradient-to-r from-red-600/90 via-rose-600/90 to-pink-700/90" />
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }} />
          </div>

          {/* Enhanced Floating Shapes */}
          <div className="absolute top-6 left-8 w-16 h-16 bg-white/10 rounded-full animate-pulse" />
          <div className="absolute top-12 right-16 w-12 h-12 bg-white/10 rounded-full animate-pulse delay-1000" />
          <div className="absolute bottom-12 left-1/3 w-10 h-10 bg-white/10 rounded-full animate-pulse delay-500" />
          <div className="absolute top-1/2 left-12 w-6 h-6 bg-white/8 rounded-full animate-pulse delay-300" />
          <div className="absolute top-1/3 right-1/4 w-12 h-12 bg-white/8 rounded-full animate-pulse delay-700" />
          <div className="absolute bottom-1/3 right-8 w-8 h-8 bg-white/8 rounded-full animate-pulse delay-900" />

          <div className="relative px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 inline-flex items-center rounded-full bg-white/10 backdrop-blur-sm px-6 py-2 text-sm font-medium text-white/90 ring-1 ring-white/20">
                <Shield className="mr-2 h-4 w-4" />
                Security Center
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Account <span className="bg-gradient-to-r from-red-200 to-rose-200 bg-clip-text text-transparent">Security</span>
              </h1>
              <p className="mt-4 text-lg leading-8 text-red-100">
                Manage your password and security settings to keep your account safe and secure.
              </p>
            </div>
          </div>

          {/* Bottom Wave */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg className="w-full h-12 fill-current text-white" viewBox="0 0 1440 120" preserveAspectRatio="none">
              <path d="M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z" />
            </svg>
          </div>
        </div>

        {/* Change Password Card */}
        <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 animate-fadeInUp">
        <CardHeader className="border-b border-slate-100/50 pb-4">
          <CardTitle className="text-lg font-semibold bg-gradient-to-r from-red-700 via-rose-700 to-pink-700 bg-clip-text text-transparent flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-red-100 to-rose-100 border border-red-200/50">
              <Key className="h-5 w-5 text-red-600" />
            </div>
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handlePasswordChange} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Key className="h-4 w-4 text-red-600" />
                Current Password
              </Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="pr-10 border-red-200/50 focus:border-red-400 focus:ring-red-400/20 transition-all duration-300"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-red-50 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4 text-red-600" /> : <Eye className="h-4 w-4 text-red-600" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Lock className="h-4 w-4 text-rose-600" />
                New Password
              </Label>
              <Input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="border-rose-200/50 focus:border-rose-400 focus:ring-rose-400/20 transition-all duration-300"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Lock className="h-4 w-4 text-pink-600" />
                Confirm New Password
              </Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="border-pink-200/50 focus:border-pink-400 focus:ring-pink-400/20 transition-all duration-300"
              />
            </div>

            <Button
              type="submit"
              disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="w-full bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 hover:from-red-700 hover:via-rose-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
            >
              {isChangingPassword ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Update Password
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      </div>
    </>
  );
};
