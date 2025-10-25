import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff, Shield, Lock, CheckCircle, AlertCircle } from 'lucide-react';

interface StudentPasswordChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  studentId: string;
}

interface PasswordStrength {
  score: number;
  feedback: string[];
  color: string;
  label: string;
}

export const StudentPasswordChangeModal: React.FC<StudentPasswordChangeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  studentId
}) => {
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({
    score: 0,
    feedback: [],
    color: 'bg-gray-300',
    label: 'Very Weak'
  });

  const checkPasswordStrength = (password: string): PasswordStrength => {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (password.length >= 8) {
      score += 20;
    } else {
      feedback.push('At least 8 characters');
    }

    if (password.length >= 12) {
      score += 10;
    }

    // Uppercase check
    if (/[A-Z]/.test(password)) {
      score += 20;
    } else {
      feedback.push('One uppercase letter');
    }

    // Lowercase check
    if (/[a-z]/.test(password)) {
      score += 20;
    } else {
      feedback.push('One lowercase letter');
    }

    // Number check
    if (/\d/.test(password)) {
      score += 20;
    } else {
      feedback.push('One number');
    }

    // Special character check
    if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      score += 10;
    } else {
      feedback.push('One special character');
    }

    // Determine strength
    let color = 'bg-red-500';
    let label = 'Very Weak';

    if (score >= 80) {
      color = 'bg-green-500';
      label = 'Strong';
    } else if (score >= 60) {
      color = 'bg-yellow-500';
      label = 'Good';
    } else if (score >= 40) {
      color = 'bg-orange-500';
      label = 'Fair';
    } else if (score >= 20) {
      color = 'bg-red-400';
      label = 'Weak';
    }

    return {
      score: Math.min(score, 100),
      feedback,
      color,
      label
    };
  };

  useEffect(() => {
    if (formData.newPassword) {
      setPasswordStrength(checkPasswordStrength(formData.newPassword));
    } else {
      setPasswordStrength({
        score: 0,
        feedback: [],
        color: 'bg-gray-300',
        label: 'Very Weak'
      });
    }
  }, [formData.newPassword]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.currentPassword) {
      toast({
        title: "Validation Error",
        description: "Please enter your current password",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.newPassword) {
      toast({
        title: "Validation Error",
        description: "Please enter a new password",
        variant: "destructive",
      });
      return false;
    }

    if (formData.newPassword.length < 8) {
      toast({
        title: "Validation Error",
        description: "New password must be at least 8 characters long",
        variant: "destructive",
      });
      return false;
    }

    if (passwordStrength.score < 40) {
      toast({
        title: "Validation Error",
        description: "New password is too weak. Please choose a stronger password",
        variant: "destructive",
      });
      return false;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        title: "Validation Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return false;
    }

    if (formData.currentPassword === formData.newPassword) {
      toast({
        title: "Validation Error",
        description: "New password must be different from current password",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/auth/student/change-password/${studentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_password: formData.currentPassword,
          new_password: formData.newPassword,
          confirm_password: formData.confirmPassword
        })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Password Changed Successfully",
          description: data.message || "Your password has been updated. Please login with your new password.",
        });
        onSuccess();
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to change password. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      console.error('Password change error:', error);
      const errorMessage = error instanceof Error ? error.message : "An error occurred while changing password";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md mx-auto">
        <DialogHeader>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-full">
              <Shield className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                Change Password
              </DialogTitle>
              <p className="text-sm text-slate-600">
                For security, please change your default password
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Current Password */}
          <div className="space-y-2">
            <Label htmlFor="current-password" className="text-sm font-semibold text-slate-700">
              Current Password
            </Label>
            <div className="relative">
              <Input
                id="current-password"
                name="currentPassword"
                type={showPasswords.current ? "text" : "password"}
                placeholder="Enter current password"
                value={formData.currentPassword}
                onChange={handleChange}
                required
                className="pr-12"
                disabled={loading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-4 hover:bg-transparent"
                onClick={() => togglePasswordVisibility('current')}
                disabled={loading}
              >
                {showPasswords.current ? (
                  <EyeOff className="h-4 w-4 text-slate-400" />
                ) : (
                  <Eye className="h-4 w-4 text-slate-400" />
                )}
              </Button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-sm font-semibold text-slate-700">
              New Password
            </Label>
            <div className="relative">
              <Input
                id="new-password"
                name="newPassword"
                type={showPasswords.new ? "text" : "password"}
                placeholder="Enter new password"
                value={formData.newPassword}
                onChange={handleChange}
                required
                className="pr-12"
                disabled={loading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-4 hover:bg-transparent"
                onClick={() => togglePasswordVisibility('new')}
                disabled={loading}
              >
                {showPasswords.new ? (
                  <EyeOff className="h-4 w-4 text-slate-400" />
                ) : (
                  <Eye className="h-4 w-4 text-slate-400" />
                )}
              </Button>
            </div>

            {/* Password Strength Indicator */}
            {formData.newPassword && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Password Strength:</span>
                  <span className={`text-xs font-medium ${
                    passwordStrength.score >= 60 ? 'text-green-600' :
                    passwordStrength.score >= 40 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {passwordStrength.label}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                    style={{ width: `${passwordStrength.score}%` }}
                  />
                </div>
                {passwordStrength.feedback.length > 0 && (
                  <div className="text-xs text-slate-500 space-y-1">
                    <p>Add: {passwordStrength.feedback.join(', ')}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-sm font-semibold text-slate-700">
              Confirm New Password
            </Label>
            <div className="relative">
              <Input
                id="confirm-password"
                name="confirmPassword"
                type={showPasswords.confirm ? "text" : "password"}
                placeholder="Confirm new password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className="pr-12"
                disabled={loading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-4 hover:bg-transparent"
                onClick={() => togglePasswordVisibility('confirm')}
                disabled={loading}
              >
                {showPasswords.confirm ? (
                  <EyeOff className="h-4 w-4 text-slate-400" />
                ) : (
                  <Eye className="h-4 w-4 text-slate-400" />
                )}
              </Button>
            </div>

            {/* Password Match Indicator */}
            {formData.confirmPassword && (
              <div className="flex items-center space-x-2 text-xs">
                {formData.newPassword === formData.confirmPassword ? (
                  <>
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span className="text-green-600">Passwords match</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3 w-3 text-red-500" />
                    <span className="text-red-600">Passwords do not match</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Password Requirements */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-start space-x-2">
              <Lock className="h-4 w-4 text-slate-400 mt-0.5" />
              <div className="text-xs text-slate-600">
                <p className="font-semibold mb-2">Password Requirements:</p>
                <ul className="space-y-1">
                  <li className={formData.newPassword.length >= 8 ? 'text-green-600' : 'text-slate-500'}>
                    • At least 8 characters
                  </li>
                  <li className={/[A-Z]/.test(formData.newPassword) ? 'text-green-600' : 'text-slate-500'}>
                    • One uppercase letter
                  </li>
                  <li className={/[a-z]/.test(formData.newPassword) ? 'text-green-600' : 'text-slate-500'}>
                    • One lowercase letter
                  </li>
                  <li className={/\d/.test(formData.newPassword) ? 'text-green-600' : 'text-slate-500'}>
                    • One number
                  </li>
                  <li className={/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(formData.newPassword) ? 'text-green-600' : 'text-slate-500'}>
                    • One special character
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Changing...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4" />
                  <span>Change Password</span>
                </div>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};