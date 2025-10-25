import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Upload, Banknote, FileImage, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface BankTransferDetailsProps {
  value: {
    bank_name: string;
    bank_code?: string;
    transaction_number: string;
    transaction_screenshot_url?: string;
  };
  onChange: (details: any) => void;
  onFileUpload: (file: File) => Promise<string>;
  errors: Record<string, string>;
  disabled?: boolean;
}

export const BankTransferDetails: React.FC<BankTransferDetailsProps> = ({
  value,
  onChange,
  onFileUpload,
  errors,
  disabled = false
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

      <Card className="mt-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300 animate-slideInUp">
        <CardHeader className="border-b border-blue-200 bg-gradient-to-r from-blue-100 to-indigo-100">
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
              <Banknote className="h-5 w-5" />
            </div>
            Bank Transfer Details
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bank Name */}
            <div className="space-y-2">
              <Label htmlFor="bank_name" className="text-blue-900 font-semibold flex items-center gap-2">
                <Banknote className="h-4 w-4 text-blue-600" />
                Bank Name *
              </Label>
              <Input
                id="bank_name"
                value={value.bank_name || ''}
                onChange={(e) => onChange({ ...value, bank_name: e.target.value })}
                placeholder="e.g., Commercial Bank of Ethiopia"
                disabled={disabled}
                className={`border-blue-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 transition-all duration-200 ${
                  errors.bank_name ? 'border-red-500 focus:ring-red-200' : ''
                }`}
              />
              {errors.bank_name && (
                <p className="text-red-500 text-sm flex items-center gap-1">
                  <X className="h-3 w-3" />
                  {errors.bank_name}
                </p>
              )}
            </div>

            {/* Bank Code */}
            <div className="space-y-2">
              <Label htmlFor="bank_code" className="text-blue-900 font-semibold">
                Bank Code (Optional)
              </Label>
              <Input
                id="bank_code"
                value={value.bank_code || ''}
                onChange={(e) => onChange({ ...value, bank_code: e.target.value })}
                placeholder="e.g., 001"
                disabled={disabled}
                className="border-blue-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
              />
              <p className="text-xs text-blue-600">Branch or bank identifier code</p>
            </div>
          </div>

          {/* Transaction Number */}
          <div className="space-y-2">
            <Label htmlFor="transaction_number" className="text-blue-900 font-semibold flex items-center gap-2">
              <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Transaction Number *
            </Label>
            <Input
              id="transaction_number"
              value={value.transaction_number || ''}
              onChange={(e) => onChange({ ...value, transaction_number: e.target.value })}
              placeholder="Enter transaction/reference number"
              disabled={disabled}
              className={`border-blue-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 transition-all duration-200 ${
                errors.transaction_number ? 'border-red-500 focus:ring-red-200' : ''
              }`}
            />
            {errors.transaction_number && (
              <p className="text-red-500 text-sm flex items-center gap-1">
                <X className="h-3 w-3" />
                {errors.transaction_number}
              </p>
            )}
            <p className="text-xs text-blue-600">Reference number from your bank transfer receipt</p>
          </div>

          {/* Transaction Screenshot */}
          <div className="space-y-3">
            <Label htmlFor="screenshot" className="text-blue-900 font-semibold flex items-center gap-2">
              <FileImage className="h-4 w-4 text-blue-600" />
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
                    className="border-blue-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 transition-all duration-200 file:mr-4 file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {uploading && (
                    <div className="absolute inset-0 bg-white/90 flex items-center justify-center rounded-md">
                      <div className="text-center space-y-2">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                        <p className="text-xs text-blue-600 font-medium">Uploading...</p>
                        <div className="w-32 h-1 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 upload-progress"
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-blue-600">
                    Upload JPG, PNG, or PDF (max 5MB)
                  </p>
                  {value.transaction_screenshot_url && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleRemoveScreenshot}
                      disabled={disabled}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors text-xs"
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
                className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 transition-all duration-200"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading...' : 'Choose File'}
              </Button>
            </div>

            {value.transaction_screenshot_url && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileImage className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-blue-800 font-medium">Screenshot uploaded</span>
                  </div>
                  <a
                    href={value.transaction_screenshot_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
                  >
                    View file
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Security Notice */}
          <div className="p-4 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="h-3 w-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>
              <div className="text-xs text-blue-800">
                <p className="font-semibold mb-1">Security Notice:</p>
                <ul className="space-y-1 text-blue-700">
                  <li>• Ensure the transaction number matches your bank receipt</li>
                  <li>• Upload a clear screenshot of the transaction confirmation</li>
                  <li>• All documents are encrypted and stored securely</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};