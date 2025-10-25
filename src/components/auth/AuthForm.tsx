import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Loader2, GraduationCap, Eye, EyeOff, Sparkles, Shield, Lock, User, School, Send } from 'lucide-react';
import { Footer } from '@/components/layout/Footer';
import { OTPVerification } from './OTPVerification';
import { StudentPasswordChangeModal } from './StudentPasswordChangeModal';
import { getCSRFToken } from '@/utils/csrf';

export const AuthForm = () => {
  const { signIn, signInStudent } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [loginType, setLoginType] = useState<'staff' | 'student' | 'parent' | 'teacher'>('staff');
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [studentData, setStudentData] = useState<{ student_id: string; full_name?: string; email?: string } | null>(null);

  // New states for password → Telegram → OTP flow
  const [authStage, setAuthStage] = useState<'password' | 'telegram-linking' | 'otp'>('password');
  const [tempSessionToken, setTempSessionToken] = useState('');
  const [telegramLinkingInfo, setTelegramLinkingInfo] = useState<{
    linking_token?: string;
    telegram_link?: string;
    bot_username?: string;
    expires_in_minutes?: number;
    instructions?: string;
    registered_phone?: string;
    otp_id?: string;
    can_skip_to_email?: boolean;
  } | null>(null);
  const [skippingToEmail, setSkippingToEmail] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    studentId: '',
    identifier: '', // For parent/teacher phone or email
    parentTeacherPassword: '', // For parent/teacher password
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  // Helper to create headers with CSRF token
  const createHeadersWithCSRF = (contentType: string = 'application/json'): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': contentType,
    };
    const csrfToken = getCSRFToken();
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
    return headers;
  };

  const handleStaffSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/auth/login-with-otp`, {
        method: 'POST',
        headers: createHeadersWithCSRF('application/x-www-form-urlencoded'),
        credentials: 'include',
        body: new URLSearchParams({
          username: formData.email,
          password: formData.password
        })
      });

      const data = await response.json();

      if (data.success && data.requires_telegram_linking) {
        // Password verified, but need to link Telegram first
        setTelegramLinkingInfo({
          ...data.telegram_linking_info,
          otp_id: data.otp_id,
          can_skip_to_email: data.can_skip_to_email
        });
        setAuthStage('telegram-linking');
        setUserEmail(formData.email);
        toast({
          title: "Password Verified",
          description: data.message,
        });
      } else if (data.success && data.requires_otp && data.otp_sent) {
        // Password verified, now show OTP verification screen
        setUserEmail(formData.email);
        setShowOTP(true);
        toast({
          title: "OTP Sent",
          description: data.message,
        });
      } else if (data.success && !data.requires_otp) {
        // This shouldn't happen with OTP flow, but handle it
        toast({
          title: "Success",
          description: "Signed in successfully!",
        });
        // Use original signIn method for backwards compatibility
        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          throw error;
        }
      } else {
        // Handle error cases
        toast({
          title: "Authentication Error",
          description: data.message || "Authentication failed",
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      console.error('Sign in error:', error);
      const errorMessage = error instanceof Error ? error.message : "An error occurred during sign in";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await signInStudent(formData.studentId, formData.password);

      if (error) {
        toast({
          title: "Authentication Error",
          description: error.message || "Student authentication failed",
          variant: "destructive",
        });
        return;
      }

      if (data) {
        // Check if student needs to change password
        if (data.requires_password_change || data.is_default_password) {
          setStudentData(data);
          setShowPasswordChangeModal(true);
          toast({
            title: "Password Change Required",
            description: "You must change your password before continuing.",
          });
        } else {
          toast({
            title: "Welcome!",
            description: `Signed in as ${data.full_name || data.student_id}`,
          });

          // Small delay to ensure token is saved
          await new Promise(resolve => setTimeout(resolve, 100));

          // Redirect to student dashboard
          window.location.href = '/student-dashboard';
        }
      }
    } catch (error: unknown) {
      console.error('Student sign in error:', error);
      const errorMessage = error instanceof Error ? error.message : "An error occurred during student sign in";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleParentTeacherSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const role = loginType; // 'parent' or 'teacher'

      // Step 1: Password Login
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/auth/password-login`, {
        method: 'POST',
        headers: createHeadersWithCSRF(),
        credentials: 'include',
        body: JSON.stringify({
          phone: formData.identifier,
          password: formData.parentTeacherPassword,
          role: role
        })
      });

      const data = await response.json();

      if (data.success) {
        // Save temp session token
        setTempSessionToken(data.temp_session_token);

        if (data.requires_telegram_linking) {
          // Must link Telegram first
          setTelegramLinkingInfo(data.telegram_linking_info);
          setAuthStage('telegram-linking');
          toast({
            title: "Password Verified",
            description: data.message,
          });
        } else if (data.requires_otp) {
          // Already linked, OTP sent
          setUserEmail(formData.identifier);
          setAuthStage('otp');
          setShowOTP(true);
          toast({
            title: "OTP Sent",
            description: data.message,
          });
        }
      } else {
        toast({
          title: "Authentication Error",
          description: data.detail || data.message || "Invalid phone number or password",
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      console.error('Parent/Teacher sign in error:', error);
      const errorMessage = error instanceof Error ? error.message : "An error occurred during sign in";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Polling for Telegram linking (for both parent/teacher and staff)
  useEffect(() => {
    if (authStage === 'telegram-linking') {
      const interval = setInterval(async () => {
        try {
          // For parent/teacher - use temp_session_token
          if (tempSessionToken) {
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/auth/verify-telegram-linked`, {
              method: 'POST',
              headers: createHeadersWithCSRF(),
              credentials: 'include',
              body: JSON.stringify({
                temp_session_token: tempSessionToken
              })
            });

            const data = await response.json();

            if (data.linked && data.otp_sent) {
              // Telegram linked! Move to OTP stage
              setAuthStage('otp');
              setShowOTP(true);
              toast({
                title: "Telegram Linked!",
                description: data.message,
              });
              clearInterval(interval);
            }
          }
          // For staff - use linking_token and otp_id
          else if (telegramLinkingInfo?.linking_token) {
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/auth/verify-staff-telegram-linked`, {
              method: 'POST',
              headers: createHeadersWithCSRF(),
              credentials: 'include',
              body: JSON.stringify({
                linking_token: telegramLinkingInfo.linking_token,
                otp_id: telegramLinkingInfo.otp_id || ''
              })
            });

            const data = await response.json();

            if (data.linked && data.otp_sent) {
              // Telegram linked! Move to OTP stage
              setAuthStage('otp');
              setShowOTP(true);
              toast({
                title: "Telegram Linked!",
                description: data.message,
              });
              clearInterval(interval);
            }
          }
        } catch (error) {
          console.error('Error polling Telegram status:', error);
        }
      }, 2000); // Poll every 2 seconds

      return () => clearInterval(interval);
    }
  }, [authStage, tempSessionToken, telegramLinkingInfo]);

  const handlePasswordChangeSuccess = () => {
    setShowPasswordChangeModal(false);
    setStudentData(null);
    toast({
      title: "Password Changed",
      description: "Your password has been changed successfully. Please sign in again.",
    });
  };

  const handleOTPVerified = async (userData: { full_name?: string; email?: string; role?: string }) => {
    // OTP verified successfully, user is now logged in
    toast({
      title: "Welcome!",
      description: `Signed in as ${userData.full_name || userData.email}`,
    });

    // Small delay to ensure token is saved to localStorage
    await new Promise(resolve => setTimeout(resolve, 100));

    // Redirect to appropriate dashboard based on role
    if (userData.role === 'parent' || loginType === 'parent') {
      window.location.href = '/parent-dashboard';
    } else if (userData.role === 'teacher' || loginType === 'teacher') {
      window.location.href = '/teacher-dashboard';
    } else {
      window.location.href = '/dashboard';
    }
  };

  const handleBackToLogin = () => {
    setShowOTP(false);
    setUserEmail('');
  };

  const handleResendOTP = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/auth/send-otp`, {
        method: 'POST',
        headers: createHeadersWithCSRF(),
        credentials: 'include',
        body: JSON.stringify({
          email: userEmail,
          purpose: 'login'
        })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "OTP Resent",
          description: "A new OTP has been sent to your email",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to resend OTP. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      toast({
        title: "Error",
        description: "Failed to resend OTP. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSkipToEmail = async () => {
    if (!telegramLinkingInfo?.otp_id) {
      toast({
        title: "Error",
        description: "Session information not found. Please try logging in again.",
        variant: "destructive",
      });
      return;
    }

    setSkippingToEmail(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/auth/skip-telegram-to-email`, {
        method: 'POST',
        headers: createHeadersWithCSRF(),
        credentials: 'include',
        body: JSON.stringify({
          otp_id: telegramLinkingInfo.otp_id
        })
      });

      const data = await response.json();

      if (data.success && data.otp_sent) {
        toast({
          title: "OTP Sent",
          description: data.message,
        });
        // Move to OTP verification stage
        setAuthStage('otp');
        setShowOTP(true);
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to send OTP via email",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Skip to email error:', error);
      toast({
        title: "Error",
        description: "Failed to send OTP via email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSkippingToEmail(false);
    }
  };

  // Show OTP verification screen
if (showOTP) {
  return (
    <OTPVerification
      email={userEmail}
      onVerified={handleOTPVerified}
      onBack={handleBackToLogin}
      onResendOTP={handleResendOTP}
      role={loginType === 'parent' || loginType === 'teacher' ? loginType : undefined}
      identifier={loginType === 'parent' || loginType === 'teacher' ? formData.identifier : formData.email}
      tempSessionToken={tempSessionToken || undefined}
    />
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

        @keyframes floatAnimation {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
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

        .animate-float {
          animation: floatAnimation 3s ease-in-out infinite;
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        {/* Floating Shapes */}
        <div className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-br from-blue-200/30 to-purple-300/30 rounded-full animate-float" />
        <div className="absolute top-40 right-20 w-24 h-24 bg-gradient-to-br from-indigo-200/30 to-cyan-300/30 rounded-full animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-32 left-1/4 w-20 h-20 bg-gradient-to-br from-purple-200/30 to-pink-300/30 rounded-full animate-float" style={{ animationDelay: '2s' }} />

        <div className="min-h-screen flex flex-col p-4 sm:p-6 relative z-10">
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-md mx-auto animate-fadeInUp">
              {/* Premium Card with Glass Morphism */}
              <div className="relative">
                {/* Background glass effect */}
                <div className="absolute inset-0 bg-white/80 backdrop-blur-glass border border-white/30 rounded-3xl shadow-premium"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/8 via-purple-500/8 to-pink-500/8 rounded-3xl pointer-events-none"></div>

                <Card className="relative bg-transparent border-0 shadow-none rounded-3xl overflow-hidden">
                  <CardHeader className="text-center p-8 pb-6">
                    {/* Enhanced Logo Section */}
                    <div className="flex justify-center mb-6">
                      <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl animate-pulseGlow opacity-20 group-hover:opacity-30 transition-opacity duration-300"></div>
                        <div className="relative h-16 w-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl ring-4 ring-white/20 transition-all duration-300 group-hover:scale-110">
                          {loginType === 'student' ? <School className="h-8 w-8 text-white" /> : <GraduationCap className="h-8 w-8 text-white" />}
                          <div className="absolute -top-1 -right-1 h-4 w-4 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full shadow-sm animate-pulse"></div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-6">
                      <CardTitle className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-clip-text text-transparent">
                        Spring of Knowledge Academy
                      </CardTitle>
                      <CardDescription className="text-slate-600 font-medium">
                        Secure Portal Access
                      </CardDescription>
                    </div>

                    {/* Login Type Selection - Professional Design */}
                    <div className="mb-8">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Select Account Type</p>
                      <div className="grid grid-cols-3 gap-3">
                        <button
                          type="button"
                          onClick={() => setLoginType('staff')}
                          className={`group relative overflow-hidden rounded-xl p-4 transition-all duration-300 ${
                            loginType === 'staff' || loginType === 'teacher'
                              ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 scale-[1.02]'
                              : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-blue-300 hover:shadow-md'
                          }`}
                        >
                          <div className="flex flex-col items-center space-y-2">
                            <div className={`p-2 rounded-lg transition-colors ${
                              loginType === 'staff' || loginType === 'teacher' ? 'bg-white/20' : 'bg-blue-50'
                            }`}>
                              <GraduationCap className={`h-5 w-5 ${loginType === 'staff' || loginType === 'teacher' ? 'text-white' : 'text-blue-600'}`} />
                            </div>
                            <span className="text-sm font-semibold">Staff</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setLoginType('parent')}
                          className={`group relative overflow-hidden rounded-xl p-4 transition-all duration-300 ${
                            loginType === 'parent'
                              ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg shadow-green-500/30 scale-[1.02]'
                              : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-green-300 hover:shadow-md'
                          }`}
                        >
                          <div className="flex flex-col items-center space-y-2">
                            <div className={`p-2 rounded-lg transition-colors ${
                              loginType === 'parent' ? 'bg-white/20' : 'bg-green-50'
                            }`}>
                              <User className={`h-5 w-5 ${loginType === 'parent' ? 'text-white' : 'text-green-600'}`} />
                            </div>
                            <span className="text-sm font-semibold">Parent</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setLoginType('student')}
                          className={`group relative overflow-hidden rounded-xl p-4 transition-all duration-300 ${
                            loginType === 'student'
                              ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-[1.02]'
                              : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-indigo-300 hover:shadow-md'
                          }`}
                        >
                          <div className="flex flex-col items-center space-y-2">
                            <div className={`p-2 rounded-lg transition-colors ${
                              loginType === 'student' ? 'bg-white/20' : 'bg-indigo-50'
                            }`}>
                              <School className={`h-5 w-5 ${loginType === 'student' ? 'text-white' : 'text-indigo-600'}`} />
                            </div>
                            <span className="text-sm font-semibold">Student</span>
                          </div>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-center space-x-6 text-xs text-slate-400">
                      <div className="flex items-center space-x-1">
                        <Shield className="h-3 w-3" />
                        <span>Secure</span>
                      </div>
                      <div className="w-px h-4 bg-slate-300"></div>
                      <div className="flex items-center space-x-1">
                        <Lock className="h-3 w-3" />
                        <span>Protected</span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-8 pt-0">
                    {loginType === 'parent' || loginType === 'teacher' ? (
                      <>
                        {authStage === 'password' && (
                          <form onSubmit={handleParentTeacherSignIn} className="space-y-6">
                            <div className="space-y-2">
                              <Label htmlFor="signin-identifier" className="text-sm font-semibold text-slate-700">
                                Phone Number
                              </Label>
                              <div className="relative">
                                <Input
                                  id="signin-identifier"
                                  name="identifier"
                                  type="text"
                                  placeholder="Enter phone (+251... or 09...)"
                                  value={formData.identifier}
                                  onChange={handleChange}
                                  required
                                  className="h-12 rounded-xl border-slate-200 bg-white/60 backdrop-blur-sm focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                                />
                              </div>
                              <p className="text-xs text-slate-500 mt-1">
                                Enter your registered phone number
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="signin-parent-teacher-password" className="text-sm font-semibold text-slate-700">
                                Password
                              </Label>
                              <div className="relative">
                                <Input
                                  id="signin-parent-teacher-password"
                                  name="parentTeacherPassword"
                                  type={showPassword ? "text" : "password"}
                                  placeholder="Enter your password"
                                  value={formData.parentTeacherPassword}
                                  onChange={handleChange}
                                  required
                                  className="h-12 rounded-xl border-slate-200 bg-white/60 backdrop-blur-sm focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-100 transition-all duration-200 pr-12"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-4 hover:bg-transparent group"
                                  onClick={() => setShowPassword(!showPassword)}
                                >
                                  {showPassword ? (
                                    <EyeOff className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                                  ) : (
                                    <Eye className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                                  )}
                                </Button>
                              </div>
                            </div>

                            <Button
                              type="submit"
                              className="w-full h-12 rounded-xl bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                              disabled={loading}
                            >
                              {loading ? (
                                <div className="flex items-center space-x-2">
                                  <Loader2 className="h-5 w-5 animate-spin" />
                                  <span>Verifying...</span>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-2">
                                  <Lock className="h-4 w-4" />
                                  <span>Continue</span>
                                </div>
                              )}
                            </Button>
                          </form>
                        )}

                        {authStage === 'telegram-linking' && telegramLinkingInfo && (
                          <div className="space-y-6">
                            <div className="text-center">
                              <div className="flex justify-center mb-4">
                                <div className="h-16 w-16 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center">
                                  <Send className="h-8 w-8 text-white" />
                                </div>
                              </div>
                              <h3 className="text-xl font-bold text-slate-800 mb-2">
                                Link Your Telegram Account
                              </h3>
                              <p className="text-sm text-slate-600 mb-4">
                                For security, you must link your Telegram account to receive OTP codes
                              </p>
                            </div>

                            <div className="p-6 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200">
                              <p className="text-xs font-semibold text-blue-800 mb-2">Your Linking Code:</p>
                              <div className="text-4xl font-mono font-bold text-center text-blue-900 tracking-wider mb-2">
                                {telegramLinkingInfo.linking_token}
                              </div>
                              <p className="text-xs text-blue-700 text-center">
                                Registered Phone: {telegramLinkingInfo.registered_phone}
                              </p>
                            </div>

                            <a
                              href={telegramLinkingInfo.telegram_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block w-full"
                            >
                              <Button
                                type="button"
                                className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Open Telegram & Link Account
                              </Button>
                            </a>

                            <div className="text-center">
                              <div className="flex items-center justify-center space-x-2 text-sm text-slate-600">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Waiting for you to complete linking in Telegram...</span>
                              </div>
                              <p className="text-xs text-slate-500 mt-2">
                                Code expires in {telegramLinkingInfo.expires_in_minutes} minutes
                              </p>
                            </div>

                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                              <p className="text-xs text-slate-700 mb-2">
                                <strong>How to link:</strong>
                              </p>
                              <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside">
                                <li>Click the "Open Telegram" button above</li>
                                <li>The bot will open automatically</li>
                                <li>Click "START" in Telegram</li>
                                <li>You'll be redirected back here to enter OTP</li>
                              </ol>
                            </div>
                          </div>
                        )}
                      </>
                    ) : loginType === 'staff' ? (
                      <>
                        {authStage === 'password' && (
                          <form onSubmit={handleStaffSignIn} className="space-y-6">
                            <div className="space-y-2">
                              <Label htmlFor="signin-email" className="text-sm font-semibold text-slate-700">
                                Email Address / Phone Number
                              </Label>
                              <div className="relative">
                                <Input
                                  id="signin-email"
                                  name="email"
                                  type="text"
                                  placeholder="Enter your email or phone number"
                                  value={formData.email}
                                  onChange={handleChange}
                                  required
                                  className="h-12 rounded-xl border-slate-200 bg-white/60 backdrop-blur-sm focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="signin-password" className="text-sm font-semibold text-slate-700">
                                Password
                              </Label>
                              <div className="relative">
                                <Input
                                  id="signin-password"
                                  name="password"
                                  type={showPassword ? "text" : "password"}
                                  placeholder="Enter your password"
                                  value={formData.password}
                                  onChange={handleChange}
                                  required
                                  className="h-12 rounded-xl border-slate-200 bg-white/60 backdrop-blur-sm focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-100 transition-all duration-200 pr-12"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-4 hover:bg-transparent group"
                                  onClick={() => setShowPassword(!showPassword)}
                                >
                                  {showPassword ? (
                                    <EyeOff className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                                  ) : (
                                    <Eye className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                                  )}
                                </Button>
                              </div>
                            </div>

                            <Button
                              type="submit"
                              className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                              disabled={loading}
                            >
                              {loading ? (
                                <div className="flex items-center space-x-2">
                                  <Loader2 className="h-5 w-5 animate-spin" />
                                  <span>Signing In...</span>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-2">
                                  <Lock className="h-4 w-4" />
                                  <span>Sign In</span>
                                </div>
                              )}
                            </Button>
                          </form>
                        )}

                        {authStage === 'telegram-linking' && telegramLinkingInfo && (
                          <div className="space-y-6">
                            <div className="text-center">
                              <div className="flex justify-center mb-4">
                                <div className="h-16 w-16 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center">
                                  <Send className="h-8 w-8 text-white" />
                                </div>
                              </div>
                              <h3 className="text-xl font-bold text-slate-800 mb-2">
                                Link Your Telegram Account
                              </h3>
                              <p className="text-sm text-slate-600 mb-4">
                                Get OTP codes instantly via Telegram for faster login
                              </p>
                            </div>

                            <div className="p-6 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200">
                              <p className="text-xs font-semibold text-blue-800 mb-2">Your Linking Code:</p>
                              <div className="text-4xl font-mono font-bold text-center text-blue-900 tracking-wider mb-2">
                                {telegramLinkingInfo.linking_token}
                              </div>
                              <p className="text-xs text-blue-700 text-center">
                                Registered Phone: {telegramLinkingInfo.registered_phone}
                              </p>
                            </div>

                            <a
                              href={telegramLinkingInfo.telegram_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block w-full"
                            >
                              <Button
                                type="button"
                                className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Open Telegram & Link Account
                              </Button>
                            </a>

                            {telegramLinkingInfo.can_skip_to_email && (
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full h-12 rounded-xl"
                                onClick={handleSkipToEmail}
                                disabled={skippingToEmail}
                              >
                                {skippingToEmail ? (
                                  <div className="flex items-center space-x-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Sending OTP...</span>
                                  </div>
                                ) : (
                                  'Skip & Use Email Instead'
                                )}
                              </Button>
                            )}

                            <div className="text-center">
                              <div className="flex items-center justify-center space-x-2 text-sm text-slate-600">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Waiting for you to complete linking in Telegram...</span>
                              </div>
                              <p className="text-xs text-slate-500 mt-2">
                                Code expires in {telegramLinkingInfo.expires_in_minutes} minutes
                              </p>
                            </div>

                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                              <p className="text-xs text-slate-700 mb-2">
                                <strong>How to link:</strong>
                              </p>
                              <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside">
                                <li>Click the "Open Telegram" button above</li>
                                <li>The bot will open automatically</li>
                                <li>Share your phone number when prompted</li>
                                <li>OTP will be sent via Telegram automatically</li>
                              </ol>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <form onSubmit={handleStudentSignIn} className="space-y-6">
                        <div className="space-y-2">
                          <Label htmlFor="signin-student-id" className="text-sm font-semibold text-slate-700">
                            Student ID
                          </Label>
                          <div className="relative">
                            <Input
                              id="signin-student-id"
                              name="studentId"
                              type="text"
                              placeholder="Enter your student ID"
                              value={formData.studentId}
                              onChange={handleChange}
                              required
                              className="h-12 rounded-xl border-slate-200 bg-white/60 backdrop-blur-sm focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="signin-password-student" className="text-sm font-semibold text-slate-700">
                            Password
                          </Label>
                          <div className="relative">
                            <Input
                              id="signin-password-student"
                              name="password"
                              type={showPassword ? "text" : "password"}
                              placeholder="Enter your password"
                              value={formData.password}
                              onChange={handleChange}
                              required
                              className="h-12 rounded-xl border-slate-200 bg-white/60 backdrop-blur-sm focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-100 transition-all duration-200 pr-12"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-4 hover:bg-transparent group"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                              ) : (
                                <Eye className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                              )}
                            </Button>
                          </div>
                        </div>

                        <Button
                          type="submit"
                          className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                          disabled={loading}
                        >
                          {loading ? (
                            <div className="flex items-center space-x-2">
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span>Signing In...</span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <Lock className="h-4 w-4" />
                              <span>Sign In</span>
                            </div>
                          )}
                        </Button>
                      </form>
                    )}

                    {/* Information Section */}
                    <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                      <div className="flex items-start space-x-2">
                        <Shield className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-blue-800">
                          <p className="font-semibold mb-1">
                            {loginType === 'staff' ? 'Enhanced Security:' : 'Student Login:'}
                          </p>
                          <p className="text-blue-700">
                            {loginType === 'staff'
                              ? 'After entering your password, a one-time verification code will be sent to your email address for additional security.'
                              : 'Enter your Student ID and password to access the student portal. First-time login requires password change.'
                            }
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Quick Access Note - Only for Staff */}
                    {loginType === 'staff' && (
                      <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100/80 border border-slate-200/50">
                        <p className="text-xs text-slate-600 text-center">
                          <span className="font-semibold">Quick Access:</span> admin@gmail.com / admin
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
          <Footer />
        </div>
      </div>

      {/* Student Password Change Modal */}
      {showPasswordChangeModal && studentData && (
        <StudentPasswordChangeModal
          isOpen={showPasswordChangeModal}
          onClose={() => setShowPasswordChangeModal(false)}
          onSuccess={handlePasswordChangeSuccess}
          studentId={studentData.student_id}
        />
      )}
    </>
  );
};