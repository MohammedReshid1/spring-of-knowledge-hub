import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Loader2, GraduationCap, Eye, EyeOff, Sparkles, Shield, Lock } from 'lucide-react';
import { Footer } from '@/components/layout/Footer';
import { OTPVerification } from './OTPVerification';

export const AuthForm = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/auth/login-with-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          username: formData.email,
          password: formData.password
        })
      });

      const data = await response.json();

      if (data.success && data.requires_otp && data.otp_sent) {
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
    } catch (error: any) {
      console.error('Sign in error:', error);
      toast({
        title: "Error",
        description: error.message || "An error occurred during sign in",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOTPVerified = async (userData: any) => {
    // OTP verified successfully, user is now logged in
    toast({
      title: "Welcome!",
      description: `Signed in as ${userData.full_name || userData.email}`,
    });

    // Small delay to ensure token is saved to localStorage
    await new Promise(resolve => setTimeout(resolve, 100));

    // Redirect to dashboard - the token is now stored and AuthContext will pick it up
    window.location.href = '/dashboard';
  };

  const handleBackToLogin = () => {
    setShowOTP(false);
    setUserEmail('');
  };

  const handleResendOTP = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/auth/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

  // Show OTP verification screen
if (showOTP) {
  return (
    <OTPVerification
      email={userEmail}
      onVerified={handleOTPVerified}
      onBack={handleBackToLogin}
      onResendOTP={handleResendOTP}
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
                          <GraduationCap className="h-8 w-8 text-white" />
                          <div className="absolute -top-1 -right-1 h-4 w-4 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full shadow-sm animate-pulse"></div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-6">
                      <CardTitle className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-clip-text text-transparent">
                        Spring of Knowledge Academy
                      </CardTitle>
                      <div className="flex items-center justify-center text-sm text-slate-500">
                        <Sparkles className="h-4 w-4 mr-2 text-purple-400" />
                        <span>Education Management System</span>
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
                    <form onSubmit={handleSignIn} className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="signin-email" className="text-sm font-semibold text-slate-700">
                          Email Address
                        </Label>
                        <div className="relative">
                          <Input
                            id="signin-email"
                            name="email"
                            type="email"
                            placeholder="Enter your email"
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

                    {/* OTP Notice */}
                    <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                      <div className="flex items-start space-x-2">
                        <Shield className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-blue-800">
                          <p className="font-semibold mb-1">Enhanced Security:</p>
                          <p className="text-blue-700">
                            After entering your password, a one-time verification code will be sent to your email address for additional security.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Quick Access Note */}
                    <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100/80 border border-slate-200/50">
                      <p className="text-xs text-slate-600 text-center">
                        <span className="font-semibold">Quick Access:</span> admin@gmail.com / admin
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
          <Footer />
        </div>
      </div>
    </>
  );
};