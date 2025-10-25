import React, { useState } from 'react';
import { PaymentFormExtended } from '@/components/payments/PaymentFormExtended';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle, AlertCircle, Code, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PaymentTestPage() {
  const [testResults, setTestResults] = useState<any[]>([]);
  const navigate = useNavigate();

  const handlePaymentSuccess = (payment: any) => {
    setTestResults(prev => [
      ...prev,
      {
        id: Date.now(),
        type: 'success',
        message: 'Payment created successfully',
        data: payment,
        timestamp: new Date().toISOString()
      }
    ]);
  };

  const handlePaymentCancel = () => {
    navigate('/payments');
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Payment System Extension - Test Page
            </h1>
            <p className="text-slate-600">
              Test the new conditional payment method fields
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate('/payments')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Payments
          </Button>
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Test Results</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={clearResults}
                className="border-slate-300 hover:bg-slate-50"
              >
                Clear Results
              </Button>
            </div>
            <div className="space-y-2">
              {testResults.map((result) => (
                <Card key={result.id} className={`border-l-4 ${
                  result.type === 'success' ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {result.type === 'success' ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        )}
                        <span className="font-medium text-slate-800">
                          {result.message}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </Badge>
                    </div>
                    {result.data && (
                      <div className="mt-2 text-sm text-slate-600">
                        <details className="cursor-pointer">
                          <summary className="font-medium">View Response Data</summary>
                          <pre className="mt-2 p-2 bg-white/50 rounded text-xs overflow-x-auto">
                            {JSON.stringify(result.data, null, 2)}
                          </pre>
                        </details>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Test Instructions */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-l-4 border-blue-500 bg-blue-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-blue-900 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Bank Transfer Test
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p><strong>Required Fields:</strong></p>
                <ul className="list-disc list-inside ml-4 text-blue-800">
                  <li>Bank name (min 2 chars)</li>
                  <li>Transaction number (min 3 chars)</li>
                  <li>Optional bank code</li>
                  <li>Screenshot (optional)</li>
                </ul>
                <div className="mt-3 p-2 bg-blue-100 rounded text-xs text-blue-800">
                  <p>💡 Test with: Commercial Bank of Ethiopia, TXN123456789</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-purple-500 bg-purple-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-purple-900 flex items-center gap-2">
                <Code className="h-5 w-5" />
                Online/Mobile Test
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p><strong>Required Fields:</strong></p>
                <ul className="list-disc list-inside ml-4 text-purple-800">
                  <li>Transaction ID (min 3 chars)</li>
                  <li>Screenshot (optional)</li>
                </ul>
                <div className="mt-3 p-2 bg-purple-100 rounded text-xs text-purple-800">
                  <p>💡 Test with: PAY987654321</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-green-500 bg-green-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-green-900 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Legacy Methods
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p><strong>Test Cash/Check:</strong></p>
                <ul className="list-disc list-inside ml-4 text-green-800">
                  <li>Works with existing flow</li>
                  <li>No additional fields required</li>
                  <li>Backward compatible</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Form */}
        <PaymentFormExtended
          onSuccess={handlePaymentSuccess}
          onCancel={handlePaymentCancel}
        />

        {/* Manual Test Examples */}
        <div className="mt-8">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">Manual Test Examples</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3 text-slate-800">Bank Transfer Example</h4>
                  <div className="p-4 bg-slate-50 rounded-lg text-sm font-mono">
                    <div className="space-y-1">
                      <div><span className="text-slate-600">method:</span> bank_transfer</div>
                      <div><span className="text-slate-600">bank_name:</span> Commercial Bank of Ethiopia</div>
                      <div><span className="text-slate-600">transaction_number:</span> TXN123456789</div>
                      <div><span className="text-slate-600">amount:</span> 5000</div>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-3 text-slate-800">Mobile Payment Example</h4>
                  <div className="p-4 bg-slate-50 rounded-lg text-sm font-mono">
                    <div className="space-y-1">
                      <div><span className="text-slate-600">method:</span> mobile_payment</div>
                      <div><span className="text-slate-600">transaction_id:</span> MP987654321</div>
                      <div><span className="text-slate-600">amount:</span> 2500</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}