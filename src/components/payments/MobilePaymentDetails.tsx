import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Upload, Smartphone, FileImage, X, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface MobilePaymentDetailsProps {
  value: {
    transaction_id: string;
    transaction_screenshot_url?: string;
  };
  onChange: (details: any) => void;
  onFileUpload: (file: File) => Promise<string>;
  errors: Record<string, string>;
  disabled?: boolean;
  paymentMethod?: 'online_payment' | 'mobile_payment';
}

export const MobilePaymentDetails: React.FC<MobilePaymentDetailsProps> = ({
  value,
  onChange,
  onFileUpload,
  errors,
  disabled = false,
  paymentMethod = 'mobile_payment'
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Only JPG, PNG, and PDF files are allowed",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File Too Large",
        description: "File size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      const url = await onFileUpload(file);

      clearInterval(progressInterval);
      setUploadProgress(100);

      onChange({ ...value, transaction_screenshot_url: url });

      toast({
        title: "Success",
        description: "Screenshot uploaded successfully",
      });
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveScreenshot = () => {
    onChange({ ...value, transaction_screenshot_url: undefined });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getPaymentMethodLabel = () => {
    switch (paymentMethod) {
      case 'online_payment':
        return 'Online Payment';
      case 'mobile_payment':
        return 'Mobile Payment';
      default:
        return 'Mobile/Online Payment';
    }
  };

  const getPaymentMethodIcon = () => {
    switch (paymentMethod) {
      case 'online_payment':
        return (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9V3" />
          </svg>
        );
      case 'mobile_payment':
        return <Smartphone className="h-5 w-5" />;
      default:
        return <Smartphone className="h-5 w-5" />;
    }
  };

  const getMethodColor = () => {
    switch (paymentMethod) {
      case 'online_payment':
        return 'purple';
      case 'mobile_payment':
        return 'green';
      default:
        return 'blue';
    }
  };

  const methodColor = getMethodColor();

  return (
    <>
      {/* Premium Animation Styles */}
      <style jsx global>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }

        .animate-slideInUp {
          animation: slideInUp 0.5s ease-out;
        }

        .animate-pulse {
          animation: pulse 2s ease-in-out infinite;
        }

        .upload-progress {
          transition: width 0.3s ease-out;
        }
      `}</style>

      <Card className={`mt-4 bg-gradient-to-br from-${methodColor}-50 to-${methodColor === 'green' ? 'emerald' : methodColor === 'purple' ? 'indigo' : methodColor}-50 border-${methodColor}-200 shadow-lg hover:shadow-xl transition-all duration-300 animate-slideInUp`}>
        <CardHeader className={`border-b border-${methodColor}-200 bg-gradient-to-r from-${methodColor}-100 to-${methodColor === 'green' ? 'emerald' : methodColor === 'purple' ? 'indigo' : methodColor}-100`}>
          <CardTitle className={`flex items-center gap-2 text-${methodColor}-900`}>
            <div className={`p-2 rounded-lg bg-gradient-to-br from-${methodColor}-500 to-${methodColor === 'green' ? 'emerald' : methodColor === 'purple' ? 'indigo' : methodColor}-600 text-white shadow-md`}>
              {getPaymentMethodIcon()}
            </div>
            {getPaymentMethodLabel()} Details
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Transaction ID */}
          <div className="space-y-3">
            <Label htmlFor="transaction_id" className={`${methodColor}-900 font-semibold flex items-center gap-2`}>
              <CheckCircle className={`h-4 w-4 text-${methodColor}-600`} />
              Transaction ID *
            </Label>
            <Input
              id="transaction_id"
              value={value.transaction_id || ''}
              onChange={(e) => onChange({ ...value, transaction_id: e.target.value })}
              placeholder={
                paymentMethod === 'online_payment'
                  ? "Enter online payment transaction ID"
                  : "Enter mobile money transaction ID"
              }
              disabled={disabled}
              className={`border-${methodColor}-200 focus:border-${methodColor}-400 focus:ring-2 focus:ring-${methodColor}-200 transition-all duration-200 ${
                errors.transaction_id ? 'border-red-500 focus:ring-red-200' : ''
              }`}
            />
            {errors.transaction_id && (
              <p className="text-red-500 text-sm flex items-center gap-1">
                <X className="h-3 w-3" />
                {errors.transaction_id}
              </p>
            )}
            <p className={`text-xs text-${methodColor}-600`}>
              {paymentMethod === 'online_payment'
                ? "Transaction ID from your online payment confirmation (e.g., PayPal, Stripe, etc.)"
                : "Transaction ID from your mobile money provider (e.g., M-Pesa, Airtel Money, etc.)"
              }
            </p>
          </div>

          {/* Transaction Screenshot */}
          <div className="space-y-3">
            <Label htmlFor="screenshot" className={`${methodColor}-900 font-semibold flex items-center gap-2`}>
              <FileImage className={`h-4 w-4 text-${methodColor}-600`} />
              Transaction Screenshot (Optional)
            </Label>

            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="relative">
                  <Input
                    id="screenshot"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileUpload}
                    disabled={disabled || uploading}
                    ref={fileInputRef}
                    className={`border-${methodColor}-200 focus:border-${methodColor}-400 focus:ring-2 focus:ring-${methodColor}-200 transition-all duration-200 file:mr-4 file:border-0 file:bg-${methodColor}-50 file:text-${methodColor}-700 hover:file:bg-${methodColor}-100`}
                  />
                  {uploading && (
                    <div className="absolute inset-0 bg-white/90 flex items-center justify-center rounded-md">
                      <div className="text-center space-y-2">
                        <div className={`animate-spin h-4 w-4 border-2 border-${methodColor}-600 border-t-transparent rounded-full mx-auto`}></div>
                        <p className={`text-xs text-${methodColor}-600 font-medium`}>Uploading...</p>
                        <div className="w-32 h-1 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r from-${methodColor}-500 to-${methodColor === 'green' ? 'emerald' : methodColor === 'purple' ? 'indigo' : methodColor}-500 upload-progress`}
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-2">
                  <p className={`text-xs text-${methodColor}-600`}>
                    Upload JPG, PNG, or PDF (max 5MB)
                  </p>
                  {value.transaction_screenshot_url && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleRemoveScreenshot}
                      disabled={disabled}
                      className={`text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors text-xs`}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || uploading}
                className={`border-${methodColor}-300 text-${methodColor}-700 hover:bg-${methodColor}-50 hover:border-${methodColor}-400 transition-all duration-200`}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading...' : 'Choose File'}
              </Button>
            </div>

            {value.transaction_screenshot_url && (
              <div className={`mt-3 p-3 bg-${methodColor}-50 border border-${methodColor}-200 rounded-lg`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileImage className={`h-4 w-4 text-${methodColor}-600`} />
                    <span className={`text-sm text-${methodColor}-800 font-medium`}>Screenshot uploaded</span>
                  </div>
                  <a
                    href={value.transaction_screenshot_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-xs text-${methodColor}-600 hover:text-${methodColor}-800 hover:underline font-medium`}
                  >
                    View file
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Payment Method Tips */}
          <div className={`p-4 rounded-lg bg-gradient-to-r from-${methodColor}-50 to-${methodColor === 'green' ? 'emerald' : methodColor === 'purple' ? 'indigo' : methodColor}-50 border border-${methodColor}-200`}>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className={`w-6 h-6 rounded-full bg-${methodColor}-100 flex items-center justify-center`}>
                  <Smartphone className={`h-3 w-3 text-${methodColor}-600`} />
                </div>
              </div>
              <div className={`text-xs text-${methodColor}-800`}>
                <p className="font-semibold mb-1">
                  {paymentMethod === 'online_payment' ? 'Online Payment Tips:' : 'Mobile Money Tips:'}
                </p>
                <ul className="space-y-1 text-{methodColor}-700">
                  {paymentMethod === 'online_payment' ? (
                    <>
                      <li>• Keep the confirmation email from your payment provider</li>
                      <li>• Take a screenshot of the successful payment page</li>
                      <li>• Save the transaction ID for future reference</li>
                    </>
                  ) : (
                    <>
                      <li>• Keep the SMS confirmation from your mobile money provider</li>
                      <li>• Take a screenshot of the transaction confirmation</li>
                      <li>• Save the transaction code for verification</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};