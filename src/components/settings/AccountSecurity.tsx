import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Eye, EyeOff, Shield, Key, Upload, User, Camera, X, MessageCircle, CheckCircle2, XCircle, Copy, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { getImageUrl } from '@/utils/imageUtils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const AccountSecurity = () => {
  const { user, student, refreshUser } = useAuth();
  const currentEntity = student || user;
  const profilePicture = currentEntity?.profile_picture;

  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(getImageUrl(profilePicture));
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Telegram linking state
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [telegramLinkedAt, setTelegramLinkedAt] = useState<string | null>(null);
  const [isCheckingTelegramStatus, setIsCheckingTelegramStatus] = useState(false);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [showLinkingDialog, setShowLinkingDialog] = useState(false);
  const [linkingToken, setLinkingToken] = useState('');
  const [telegramLink, setTelegramLink] = useState('');

  // Update preview when profile picture changes from user/student data
  useEffect(() => {
    setProfilePicturePreview(getImageUrl(profilePicture));
  }, [profilePicture]);

  // Check Telegram linking status on mount
  useEffect(() => {
    checkTelegramLinkStatus();
  }, []);

  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, or GIF image",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingPicture(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Use different endpoints for students vs regular users
      const endpoint = student ? '/students/me/profile-picture' : '/users/me/profile-picture';

      // Don't set Content-Type header - let the browser set it with the correct boundary
      const response = await apiClient.post(endpoint, formData);

      if (response.data) {
        // Convert the relative URL to full URL for preview
        setProfilePicturePreview(getImageUrl(response.data.profile_picture));
        toast({
          title: "Success",
          description: "Profile picture updated successfully!",
        });
        // Refresh user data to update the profile picture everywhere
        await refreshUser();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to upload profile picture",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPicture(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteProfilePicture = async () => {
    setIsUploadingPicture(true);
    try {
      // Use different endpoints for students vs regular users
      const endpoint = student ? '/students/me/profile-picture' : '/users/me/profile-picture';

      await apiClient.delete(endpoint);
      setProfilePicturePreview(null);
      toast({
        title: "Success",
        description: "Profile picture deleted successfully!",
      });
      // Refresh user data to update the profile picture everywhere
      await refreshUser();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to delete profile picture",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPicture(false);
    }
  };

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

  // Check Telegram linking status
  const checkTelegramLinkStatus = async () => {
    setIsCheckingTelegramStatus(true);
    try {
      const response = await apiClient.get('/telegram/link-status');
      if (response.data) {
        setTelegramLinked(response.data.linked);
        setTelegramLinkedAt(response.data.linked_at);
      }
    } catch (error: any) {
      console.error('Failed to check Telegram link status:', error);
    } finally {
      setIsCheckingTelegramStatus(false);
    }
  };

  // Generate Telegram linking token
  const handleGenerateLinkingToken = async () => {
    if (!currentEntity?.phone) {
      toast({
        title: "Error",
        description: "No phone number associated with your account. Please contact your administrator.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingToken(true);
    try {
      const response = await apiClient.post('/telegram/generate-link-token', {
        phone: currentEntity.phone
      });

      if (response.data?.success) {
        setLinkingToken(response.data.linking_token);
        setTelegramLink(response.data.telegram_link);
        setShowLinkingDialog(true);
        toast({
          title: "Success",
          description: "Linking token generated successfully!",
        });
      } else {
        toast({
          title: "Error",
          description: response.data?.message || "Failed to generate linking token",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to generate linking token",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingToken(false);
    }
  };

  // Unlink Telegram account
  const handleUnlinkTelegram = async () => {
    setIsUnlinking(true);
    try {
      const response = await apiClient.delete('/telegram/unlink');
      if (response.data?.success) {
        setTelegramLinked(false);
        setTelegramLinkedAt(null);
        toast({
          title: "Success",
          description: "Telegram account unlinked successfully!",
        });
      } else {
        toast({
          title: "Error",
          description: response.data?.message || "Failed to unlink Telegram account",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to unlink Telegram account",
        variant: "destructive",
      });
    } finally {
      setIsUnlinking(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
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

        {/* Profile Picture Card */}
        <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 animate-fadeInUp">
          <CardHeader className="border-b border-slate-100/50 pb-4">
            <CardTitle className="text-lg font-semibold bg-gradient-to-r from-blue-700 via-cyan-700 to-teal-700 bg-clip-text text-transparent flex items-center gap-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100 border border-blue-200/50">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              Profile Picture
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              {/* Profile Picture Preview */}
              <div className="relative">
                <div className="h-32 w-32 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 border-4 border-white shadow-lg overflow-hidden">
                  {profilePicturePreview ? (
                    <img
                      src={profilePicturePreview}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <User className="h-16 w-16 text-slate-400" />
                    </div>
                  )}
                </div>
                {profilePicturePreview && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-1 -right-1 h-8 w-8 rounded-full shadow-md"
                    onClick={handleDeleteProfilePicture}
                    disabled={isUploadingPicture}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Upload Button */}
              <div className="flex flex-col items-center gap-3 w-full max-w-sm">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif"
                  onChange={handleProfilePictureChange}
                  className="hidden"
                  disabled={isUploadingPicture}
                />
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingPicture}
                  className="w-full bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 hover:from-blue-700 hover:via-cyan-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  {isUploadingPicture ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-2" />
                      {profilePicturePreview ? 'Change Photo' : 'Upload Photo'}
                    </>
                  )}
                </Button>
                <p className="text-xs text-slate-500 text-center">
                  JPG, PNG or GIF (max 5MB)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

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
