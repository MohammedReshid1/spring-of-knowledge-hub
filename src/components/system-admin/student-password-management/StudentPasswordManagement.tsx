import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  SingleStudentPasswordReset,
  BulkStudentPasswordReset,
  PasswordPreviewModal,
  PasswordResetHistory,
  PasswordFormatInfo
} from './index';
import {
  Key,
  Users,
  History,
  Info,
  Eye,
  Settings,
  Shield
} from 'lucide-react';

// Type definitions
interface Student {
  id: string;
  student_id: string;
  first_name: string;
  father_name?: string;
  grandfather_name?: string;
  grade_level: string;
  email?: string;
}

export function StudentPasswordManagement() {
  const [activeTab, setActiveTab] = useState('single');
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | undefined>();

  const handlePreviewPassword = (student?: Student) => {
    setSelectedStudent(student);
    setPreviewModalOpen(true);
  };

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
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl animate-fadeInUp">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-700 to-purple-700 bg-clip-text text-transparent flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 border border-violet-200/50">
              <Settings className="h-8 w-8 text-violet-600" />
            </div>
            Student Password Management
          </h1>
          <p className="text-slate-600 font-medium text-lg">
            Comprehensive tools for managing student passwords, viewing history, and understanding password formats
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <div className="p-2 rounded-lg bg-blue-100">
              <Key className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <div className="text-sm text-gray-600">Single Reset</div>
              <div className="font-semibold text-blue-700">Individual Students</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200">
            <div className="p-2 rounded-lg bg-purple-100">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <div className="text-sm text-gray-600">Bulk Reset</div>
              <div className="font-semibold text-purple-700">Multiple Students</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-lg border border-orange-200">
            <div className="p-2 rounded-lg bg-orange-100">
              <History className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <div className="text-sm text-gray-600">History</div>
              <div className="font-semibold text-orange-700">Track Changes</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-lg border border-teal-200">
            <div className="p-2 rounded-lg bg-teal-100">
              <Shield className="h-6 w-6 text-teal-600" />
            </div>
            <div>
              <div className="text-sm text-gray-600">Format Info</div>
              <div className="font-semibold text-teal-700">Security Guide</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
        <CardHeader className="border-b border-slate-100/50 pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900">Quick Actions</CardTitle>
          <CardDescription>
            Frequently used password management operations
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={() => handlePreviewPassword()}
              className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview Password
            </Button>

            <Button
              onClick={() => setActiveTab('single')}
              variant="outline"
              className="border-blue-300 hover:bg-blue-50 text-blue-700"
            >
              <Key className="h-4 w-4 mr-2" />
              Reset Single Password
            </Button>

            <Button
              onClick={() => setActiveTab('bulk')}
              variant="outline"
              className="border-purple-300 hover:bg-purple-50 text-purple-700"
            >
              <Users className="h-4 w-4 mr-2" />
              Bulk Password Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-violet-50 p-1">
          <TabsTrigger
            value="single"
            className="data-[state=active]:bg-violet-600 data-[state=active]:text-white transition-all duration-300"
          >
            <Key className="h-4 w-4 mr-2" />
            Single Reset
          </TabsTrigger>
          <TabsTrigger
            value="bulk"
            className="data-[state=active]:bg-violet-600 data-[state=active]:text-white transition-all duration-300"
          >
            <Users className="h-4 w-4 mr-2" />
            Bulk Reset
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-[state=active]:bg-violet-600 data-[state=active]:text-white transition-all duration-300"
          >
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
          <TabsTrigger
            value="format"
            className="data-[state=active]:bg-violet-600 data-[state=active]:text-white transition-all duration-300"
          >
            <Info className="h-4 w-4 mr-2" />
            Format Info
          </TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="animate-fadeInUp">
          <SingleStudentPasswordReset
            onSuccess={(data) => {
              console.log('Single password reset successful:', data);
            }}
          />
        </TabsContent>

        <TabsContent value="bulk" className="animate-fadeInUp">
          <BulkStudentPasswordReset
            onSuccess={(data) => {
              console.log('Bulk password reset successful:', data);
            }}
          />
        </TabsContent>

        <TabsContent value="history" className="animate-fadeInUp">
          <PasswordResetHistory />
        </TabsContent>

        <TabsContent value="format" className="animate-fadeInUp">
          <PasswordFormatInfo
            showStatistics={true}
            showSecurityNotes={true}
          />
        </TabsContent>
      </Tabs>

      {/* Password Preview Modal */}
      <PasswordPreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        student={selectedStudent}
      />

      {/* Footer Info */}
      <Card className="bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200 animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-600" />
                Security Notice
              </h3>
              <p className="text-sm text-gray-600">
                All password reset operations are logged and monitored. Default passwords should be changed by students upon first login.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-600" />
                Need Help?
              </h3>
              <p className="text-sm text-gray-600">
                Contact the system administrator for assistance with password management or security concerns.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default StudentPasswordManagement;