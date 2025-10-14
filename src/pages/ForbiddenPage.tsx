import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldX, ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';

/**
 * 403 Forbidden Page
 * Displayed when user tries to access a resource they don't have permission for
 */
export default function ForbiddenPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Get permission details from location state (if passed)
  const state = location.state as any;
  const requiredPermission = state?.requiredPermission;
  const message = state?.message || 'You do not have permission to access this resource.';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="bg-red-100 rounded-full p-6">
            <ShieldX className="h-16 w-16 text-red-600" />
          </div>
        </div>

        {/* Main Alert */}
        <Alert className="border-red-200 bg-white shadow-lg">
          <AlertTitle className="text-2xl font-bold text-red-800 mb-4">
            Access Denied
          </AlertTitle>
          <AlertDescription className="space-y-4">
            <p className="text-gray-700 text-lg">
              {message}
            </p>

            {/* User Details */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <p className="text-sm text-gray-600">
                <span className="font-semibold">Your Role:</span>{' '}
                <span className="text-gray-900">{user?.role || 'Unknown'}</span>
              </p>
              {requiredPermission && (
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Required Permission:</span>{' '}
                  <span className="font-mono text-red-600 bg-red-50 px-2 py-1 rounded">
                    {requiredPermission}
                  </span>
                </p>
              )}
            </div>

            {/* Help Text */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Need Access?</span> Contact your system administrator
                to request the necessary permissions for your role.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => navigate(-1)}
                className="flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </Button>
              <Button
                onClick={() => navigate('/dashboard')}
                className="flex items-center justify-center gap-2"
              >
                <Home className="h-4 w-4" />
                Go to Dashboard
              </Button>
            </div>
          </AlertDescription>
        </Alert>

        {/* Additional Information */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Error Code: <span className="font-mono">403 - Forbidden</span>
          </p>
        </div>
      </div>
    </div>
  );
}
