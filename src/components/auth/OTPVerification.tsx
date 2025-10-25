import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { TokenStorage } from '@/utils/tokenStorage';
import { apiClient } from '@/lib/api';
import { getCSRFToken } from '@/utils/csrf';
import {
  Loader2,
  Shield,
  Mail,
  ArrowLeft,
  Clock,
  RefreshCw,
  CheckCircle,
  XCircle,
  Lock
} from 'lucide-react';

interface OTPVerificationProps {
  email: string;
  onVerified: (userData: any) => void;
  onBack: () => void;
  onResendOTP: () => void;
  role?: 'parent' | 'teacher'; // Optional role for parent/teacher login
  identifier?: string; // Original identifier (phone or email)
  tempSessionToken?: string; // For password-based flow
}

export const OTPVerification: React.FC<OTPVerificationProps> = ({
  email,
  onVerified,
  onBack,
  onResendOTP,
  role,
  identifier,
  tempSessionToken
}) => {
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [canResend, setCanResend] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  // Timer for OTP expiration
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Format time display
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle OTP input change
  const handleOtpChange = (index: number, value: string) => {
    // Only allow numbers
    const numValue = value.replace(/[^0-9]/g, '');

    const newOtpCode = [...otpCode];
    newOtpCode[index] = numValue;
    setOtpCode(newOtpCode);

    // Auto-focus next input
    if (numValue && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle key press for navigation
  const handleKeyPress = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'Enter') {
      handleVerifyOTP();
    }
  };

  // Handle paste event
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '');

    if (pastedData.length === 6) {
      const digits = pastedData.split('');
      setOtpCode(digits);
      inputRefs.current[5]?.focus();
    }
  };

  // Verify OTP
  const handleVerifyOTP = async () => {
    const code = otpCode.join('');

    if (code.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter all 6 digits",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Check if using password-based flow (temp session token)
      if (tempSessionToken) {
        // Use the new password-based OTP verification endpoint
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/auth/verify-otp-final`, {
          method: 'POST',
          headers: createHeadersWithCSRF(),
          credentials: 'include',
          body: JSON.stringify({
            temp_session_token: tempSessionToken,
            otp_code: code
          })
        });

        const data = await response.json();

        if (data.success) {
          toast({
            title: "Success!",
            description: "Login successful!",
          });

          // Store auth token
          if (data.access_token) {
            TokenStorage.setToken(data.access_token);
            apiClient.setToken(data.access_token);
          }

          onVerified(data.user);
        } else {
          toast({
            title: "Verification Failed",
            description: data.detail || data.message || "Invalid OTP code",
            variant: "destructive",
          });

          setOtpCode(['', '', '', '', '', '']);
          inputRefs.current[0]?.focus();
        }
      } else {
        // Original OTP verification flow
        const endpoint = role
          ? `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/auth/${role}/verify-otp`
          : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/auth/verify-otp`;

        const requestBody = role && identifier
          ? { identifier: identifier, code: code, role: role }
          : { email: email, code: code };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: createHeadersWithCSRF(),
          credentials: 'include',
          body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (data.success) {
          toast({
            title: "Success!",
            description: "OTP verified successfully",
          });

          if (data.access_token) {
            TokenStorage.setToken(data.access_token);
            apiClient.setToken(data.access_token);
          }

          onVerified(data.user);
        } else {
          toast({
            title: "Verification Failed",
            description: data.message || "Invalid OTP code",
            variant: "destructive",
          });

          setOtpCode(['', '', '', '', '', '']);
          inputRefs.current[0]?.focus();
        }
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      toast({
        title: "Error",
        description: "Failed to verify OTP. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    setResendLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/auth/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          purpose: 'login'
        })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "OTP Resent",
          description: "A new OTP has been sent to your email",
        });

        // Reset timer
        setTimeLeft(300);
        setCanResend(false);

        // Clear OTP input
        setOtpCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
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
    } finally {
      setResendLoading(false);
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

        .animate-pulseGlow {
          animation: pulseGlow 2s infinite;
        }

        .animate-float {
          animation: floatAnimation 3s ease-in-out infinite;
        }

        .otp-input {
          width: 3rem;
          height: 3rem;
          text-align: center;
          font-size: 1.5rem;
          font-weight: bold;
          border: 2px solid #e2e8f0;
          border-radius: 0.5rem;
          transition: all 0.2s;
        }

        .otp-input:focus {
          border-color: #3b82f6;
          outline: none;
          ring: 2px;
          ring-color: #3b82f6;
          transform: scale(1.05);
        }

        .otp-input:not(:placeholder-shown) {
          border-color: #10b981;
          background-color: #f0fdf4;
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
                    {/* Back Button */}
                    <div className="flex justify-start mb-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onBack}
                        className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                      >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                      </Button>
                    </div>

                    {/* Enhanced Logo Section */}
                    <div className="flex justify-center mb-6">
                      <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-teal-600 rounded-2xl animate-pulseGlow opacity-20 group-hover:opacity-30 transition-opacity duration-300"></div>
                        <div className="relative h-16 w-16 bg-gradient-to-br from-green-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-xl ring-4 ring-white/20 transition-all duration-300 group-hover:scale-110">
                          <Shield className="h-8 w-8 text-white" />
                          <div className="absolute -top-1 -right-1 h-4 w-4 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full shadow-sm animate-pulse"></div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-6">
                      <CardTitle className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-clip-text text-transparent">
                        Verify Your Identity
                      </CardTitle>
                      <CardDescription className="text-slate-600">
                        {identifier && !identifier.includes('@')
                          ? 'Enter the 6-digit code sent to your Telegram'
                          : 'Enter the 6-digit code sent to your email'}
                      </CardDescription>
                    </div>

                    {/* Email/Phone Display */}
                    <div className="flex items-center justify-center space-x-2 text-sm text-slate-600 mb-4">
                      <Mail className="h-4 w-4" />
                      <span className="font-medium">{identifier || email}</span>
                    </div>

                    {/* Timer */}
                    <div className="flex items-center justify-center space-x-2 text-sm mb-6">
                      <Clock className={`h-4 w-4 ${timeLeft > 60 ? 'text-blue-500' : 'text-red-500'}`} />
                      <span className={`font-mono ${timeLeft > 60 ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatTime(timeLeft)}
                      </span>
                      <span className="text-slate-500">
                        {timeLeft > 0 ? 'remaining' : 'expired'}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="p-8 pt-0">
                    {/* OTP Input Fields */}
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="otp" className="text-sm font-semibold text-slate-700">
                          Enter OTP Code
                        </Label>
                        <div className="flex justify-center space-x-2">
                          {otpCode.map((digit, index) => (
                            <Input
                              key={index}
                              ref={(el) => (inputRefs.current[index] = el)}
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={1}
                              value={digit}
                              onChange={(e) => handleOtpChange(index, e.target.value)}
                              onKeyDown={(e) => handleKeyPress(index, e)}
                              onPaste={index === 0 ? handlePaste : undefined}
                              placeholder="0"
                              className="otp-input"
                              autoComplete="off"
                            />
                          ))}
                        </div>
                      </div>

                      <Button
                        onClick={handleVerifyOTP}
                        className="w-full h-12 rounded-xl bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        disabled={loading || timeLeft === 0}
                      >
                        {loading ? (
                          <div className="flex items-center space-x-2">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Verifying...</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <Lock className="h-4 w-4" />
                            <span>Verify OTP</span>
                          </div>
                        )}
                      </Button>

                      {/* Resend OTP */}
                      <div className="text-center">
                        <p className="text-sm text-slate-600 mb-2">
                          Didn't receive the code?
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleResendOTP}
                          disabled={!canResend || resendLoading || timeLeft > 0}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 disabled:text-slate-400 disabled:hover:bg-transparent"
                        >
                          {resendLoading ? (
                            <div className="flex items-center space-x-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Resending...</span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <RefreshCw className="h-4 w-4" />
                              <span>Resend OTP</span>
                            </div>
                          )}
                        </Button>
                      </div>

                      {/* Security Notice */}
                      <div className="p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
                        <div className="flex items-start space-x-2">
                          <Shield className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <div className="text-xs text-amber-800">
                            <p className="font-semibold mb-1">Security Notice:</p>
                            <ul className="space-y-1 text-amber-700">
                              <li>• Never share this code with anyone</li>
                              <li>• This code expires in 5 minutes</li>
                              <li>• We'll never ask for your OTP via phone</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};