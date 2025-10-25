import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useBranch } from '@/contexts/BranchContext';
import { apiClient } from '@/lib/api';
import { config } from '@/lib/config';
import { TokenStorage } from '@/utils/tokenStorage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Info,
  Key,
  Shield,
  Settings,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  FileText,
  Eye,
  EyeOff
} from 'lucide-react';

// Type definitions matching backend response
interface PasswordFormatResponse {
  default_format: string;
  alternative_formats: string[];
  examples: Record<string, string>;
  description: string;
  security_notes: string[];
}

interface PasswordFormatInfoProps {
  compact?: boolean;
  showStatistics?: boolean;
  showSecurityNotes?: boolean;
}

export function PasswordFormatInfo({
  compact = false,
  showStatistics = true,
  showSecurityNotes = true
}: PasswordFormatInfoProps) {
  const { selectedBranch } = useBranch();
  const branchId = selectedBranch === 'all' ? undefined : selectedBranch || undefined;
  const enableQueries = !!selectedBranch;

  const { toast } = useToast();
  const [showExample, setShowExample] = useState(false);

  // Fetch password format information
  const { data: formatInfo, isLoading: formatLoading, refetch: refetchFormat, error: formatError } = useQuery({
    queryKey: ['password-format-info', branchId],
    queryFn: async () => {
      if (!branchId) return null;

      const response = await fetch(`${config.API_BASE_URL}/admin/students/password-reset/formats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${TokenStorage.getToken()}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch password format information');
      }

      return response.json() as Promise<PasswordFormatResponse>;
    },
    enabled: enableQueries,
  });

  const generateExamplePassword = () => {
    if (!formatInfo) return 'Loading...';

    // Generate a realistic example based on the format
    const firstName = 'Ahmed';
    const grandfatherName = 'Mohammed';
    const suffix = '321';

    return `${firstName.toLowerCase()}.${grandfatherName.toLowerCase()}${suffix}`;
  };

  if (compact) {
    return (
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Key className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900">Password Format</h3>
              <p className="text-sm text-blue-700">{formatInfo?.default_format || 'firstname.grandfathername321'}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowExample(!showExample)}
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              {showExample ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {showExample && (
            <div className="mt-3 p-3 bg-white rounded-lg border border-blue-200">
              <div className="text-sm font-medium text-gray-700">Example:</div>
              <div className="font-mono text-blue-600">{formatInfo?.examples ? Object.keys(formatInfo.examples)[0] : generateExamplePassword()}</div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.5s ease-out;
        }
      `}</style>

      {/* Header */}
      <Card className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl animate-fadeInUp">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-700 to-blue-700 bg-clip-text text-transparent flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 border border-indigo-200/50">
              <Info className="h-6 w-6 text-indigo-600" />
            </div>
            Password Format Information
          </h2>
          <p className="text-slate-600 font-medium">
            Understanding the default password format and security guidelines for student accounts
          </p>
        </div>
      </Card>

      {formatLoading ? (
        <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl">
          <CardContent className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
          </CardContent>
        </Card>
      ) : !formatInfo ? (
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {formatError?.message || 'Failed to load password format information. Please try again.'}
          </AlertDescription>
        </Alert>
      ) : (
        <Tabs defaultValue="format" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-indigo-50">
            <TabsTrigger value="format" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
              <Settings className="h-4 w-4 mr-2" />
              Format & Examples
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
              <Shield className="h-4 w-4 mr-2" />
              Security Notes
            </TabsTrigger>
          </TabsList>

          {/* Format Tab */}
          <TabsContent value="format" className="space-y-6 animate-fadeInUp">
            <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl">
              <CardHeader className="border-b border-slate-100/50 pb-4">
                <CardTitle className="text-lg font-semibold bg-gradient-to-r from-indigo-700 to-blue-700 bg-clip-text text-transparent flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 border border-indigo-200/50">
                    <Key className="h-5 w-5 text-indigo-600" />
                  </div>
                  Default Password Format
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Default Format</h4>
                    <Badge variant="outline" className="text-lg font-mono bg-indigo-100 text-indigo-800 border-indigo-200 p-2">
                      {formatInfo.default_format}
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Description</h4>
                  <p className="text-gray-700">{formatInfo.description}</p>
                </div>

                {formatInfo.alternative_formats && formatInfo.alternative_formats.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Alternative Formats</h4>
                      <div className="space-y-2">
                        {formatInfo.alternative_formats.map((format, index) => (
                          <Badge key={index} variant="outline" className="text-sm font-mono bg-gray-100 text-gray-800 border-gray-200 p-2 mr-2">
                            {format}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {formatInfo.examples && Object.keys(formatInfo.examples).length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Examples</h4>
                      <div className="space-y-2">
                        {Object.entries(formatInfo.examples).map(([password, description], index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <code className="font-mono text-blue-800 font-semibold">{password}</code>
                            <span className="text-sm text-gray-600">{description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6 animate-fadeInUp">
            <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl">
              <CardHeader className="border-b border-slate-100/50 pb-4">
                <CardTitle className="text-lg font-semibold bg-gradient-to-r from-indigo-700 to-blue-700 bg-clip-text text-transparent flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 border border-indigo-200/50">
                    <Shield className="h-5 w-5 text-indigo-600" />
                  </div>
                  Security Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-3">
                  {formatInfo.security_notes.map((note, index) => (
                    <Alert key={index} className="bg-amber-50 border-amber-200">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-800">
                        {note}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
    </Tabs>
  )}
</div>
  );
}