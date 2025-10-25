import React, { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useLiveData } from '@/hooks/useLiveData';
import { BranchLoadingWrapper } from '@/components/common/BranchLoadingWrapper';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ParentContactCard } from '@/components/communication/ParentContactCard';
import { QuickMessageDialog } from '@/components/communication/QuickMessageDialog';
import { ClassAnnouncementForm } from '@/components/communication/ClassAnnouncementForm';
import { toast } from 'sonner';
import {
  MessageSquare,
  Megaphone,
  Users,
  Send,
  Search,
  Filter,
  TrendingUp,
  Mail,
  CheckCircle2,
  Clock
} from 'lucide-react';

export const TeacherCommunicationPage = () => {
  const { user } = useAuth();
  const { isTeacher } = useRoleAccess();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedParent, setSelectedParent] = useState<any>(null);
  const [showMessageDialog, setShowMessageDialog] = useState(false);

  // Enable real-time updates
  useLiveData(['classes', 'students'], {
    additionalQueryKeys: ['teacher-communication']
  });

  // Fetch teacher's classes
  const { data: teacherClassesResponse } = useQuery({
    queryKey: ['teacher-classes', user?.id],
    queryFn: async () => {
      const { data, error } = await apiClient.getMyTeacherClasses();
      if (error) throw new Error(error);
      return data;
    },
    enabled: isTeacher && !!user?.id,
  });

  const teacherClasses = teacherClassesResponse?.classes || [];

  // Mock parent data based on teacher's classes
  const mockParents = useMemo(() => {
    const parents: any[] = [];

    teacherClasses.forEach((cls: any, clsIdx: number) => {
      const studentsCount = cls.current_enrollment || 20;

      for (let i = 0; i < Math.min(studentsCount, 5); i++) {
        const parentId = `parent-${cls.id}-${i}`;
        const studentId = `student-${cls.id}-${i}`;

        parents.push({
          id: parentId,
          parent_id: parentId,
          father_name: `Mr. Parent ${clsIdx * 5 + i + 1}`,
          mother_name: `Mrs. Parent ${clsIdx * 5 + i + 1}`,
          primary_phone: `+251-91${(clsIdx * 5 + i).toString().padStart(7, '0')}`,
          secondary_phone: `+251-92${(clsIdx * 5 + i).toString().padStart(7, '0')}`,
          email: `parent${clsIdx * 5 + i + 1}@example.com`,
          address: `Address ${clsIdx * 5 + i + 1}, City`,
          relationship: i % 2 === 0 ? 'Parents' : 'Guardian',
          students: [{
            id: studentId,
            name: `Student ${clsIdx * 5 + i + 1}`,
            grade_level: cls.grade_level || 'Grade 10',
            class_name: cls.name || cls.class_name,
          }]
        });
      }
    });

    return parents;
  }, [teacherClasses]);

  // Filter parents
  const filteredParents = useMemo(() => {
    return mockParents.filter(parent => {
      const matchesSearch = searchQuery === '' ||
        parent.father_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        parent.mother_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        parent.guardian_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        parent.students.some((s: any) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesClass = selectedClass === 'all' ||
        parent.students.some((s: any) => {
          const cls = teacherClasses.find((c: any) => c.id === selectedClass);
          return cls && (s.class_name === cls.name || s.class_name === cls.class_name);
        });

      return matchesSearch && matchesClass;
    });
  }, [mockParents, searchQuery, selectedClass, teacherClasses]);

  // Handle sending individual message
  const handleSendMessage = async (messageData: any) => {
    try {
      // Get parent's user_id from the parent object
      const parent = mockParents.find(p => p.id === messageData.parent_id);

      if (!parent) {
        throw new Error('Parent not found');
      }

      // For now, use parent_id as user_id (in production, you'd get actual user_id from parent record)
      // In real implementation, parent should have a user_id field from database
      const { data, error } = await apiClient.sendMessage({
        recipients: [parent.parent_id], // Use parent_id as user_id
        subject: messageData.subject,
        content: messageData.message,
        message_type: 'parent_communication',
        priority: messageData.priority,
        recipient_type: 'individual',
      });

      if (error) {
        throw new Error(error);
      }

      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  // Handle sending class announcement
  const handleSendAnnouncement = async (announcementData: any) => {
    try {
      const { data, error } = await apiClient.sendAnnouncement({
        title: announcementData.title,
        content: announcementData.message,
        announcement_type: announcementData.type,
        target_audience: 'parents',
        class_ids: announcementData.class_ids,
        priority: announcementData.send_notification ? 'normal' : 'low',
      });

      if (error) {
        throw new Error(error);
      }

      return data;
    } catch (error) {
      console.error('Error sending announcement:', error);
      throw error;
    }
  };

  // Handle contact actions
  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const handleEmail = (email: string) => {
    window.location.href = `mailto:${email}`;
  };

  const handleMessageParent = (parent: any) => {
    setSelectedParent(parent);
    setShowMessageDialog(true);
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const totalParents = mockParents.length;
    const totalClasses = teacherClasses.length;
    const totalStudents = teacherClasses.reduce((sum: number, cls: any) =>
      sum + (cls.current_enrollment || 0), 0);

    return {
      totalParents,
      totalClasses,
      totalStudents,
      messagesSent: 42, // Mock data
      announcementsSent: 8 // Mock data
    };
  }, [mockParents, teacherClasses]);

  if (!isTeacher) {
    return (
      <div className="p-6">
        <Card className="p-6 text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Access Denied</h2>
          <p className="text-gray-600">This page is only accessible to teachers.</p>
        </Card>
      </div>
    );
  }

  return (
    <BranchLoadingWrapper loadingMessage="Loading communication center...">
      <div className="space-y-6 p-6">
        {/* Hero Header */}
        <div className="relative bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white rounded-lg p-8 overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                <MessageSquare className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Parent Communication Hub</h1>
                <p className="text-green-100 mt-1">
                  Connect with parents and send announcements
                </p>
              </div>
            </div>
          </div>

          {/* Wave SVG divider */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-16">
              <path
                d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z"
                className="fill-current text-gray-50"
              />
            </svg>
          </div>
        </div>

        {/* Statistics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Parents</p>
                <p className="text-2xl font-bold text-blue-900">{stats.totalParents}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">My Classes</p>
                <p className="text-2xl font-bold text-green-900">{stats.totalClasses}</p>
              </div>
              <Megaphone className="h-8 w-8 text-green-500" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Total Students</p>
                <p className="text-2xl font-bold text-purple-900">{stats.totalStudents}</p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Messages Sent</p>
                <p className="text-2xl font-bold text-orange-900">{stats.messagesSent}</p>
              </div>
              <Mail className="h-8 w-8 text-orange-500" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-pink-50 to-pink-100 border-pink-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-pink-600">Announcements</p>
                <p className="text-2xl font-bold text-pink-900">{stats.announcementsSent}</p>
              </div>
              <Megaphone className="h-8 w-8 text-pink-500" />
            </div>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="individual" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="individual" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Individual Messages
            </TabsTrigger>
            <TabsTrigger value="announcements" className="flex items-center gap-2">
              <Megaphone className="h-4 w-4" />
              Class Announcements
            </TabsTrigger>
          </TabsList>

          {/* Individual Messages Tab */}
          <TabsContent value="individual" className="space-y-6">
            {/* Search and Filters */}
            <Card className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search parents or students..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="w-full md:w-64">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {teacherClasses.map((cls: any) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name || cls.class_name} - {cls.grade_level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Card>

            {/* Parent Contact List */}
            {filteredParents.length === 0 ? (
              <Card className="p-12 text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Parents Found</h3>
                <p className="text-gray-600">
                  {searchQuery || selectedClass !== 'all'
                    ? 'Try adjusting your filters'
                    : 'No parent contacts available'}
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredParents.map((parent) => (
                  <ParentContactCard
                    key={parent.id}
                    parent={parent}
                    onSendMessage={handleMessageParent}
                    onCall={handleCall}
                    onEmail={handleEmail}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Class Announcements Tab */}
          <TabsContent value="announcements">
            <ClassAnnouncementForm
              classes={teacherClasses.map((cls: any) => ({
                id: cls.id,
                name: cls.name || cls.class_name,
                grade_level: cls.grade_level,
                subject: cls.subject,
                current_enrollment: cls.current_enrollment
              }))}
              onSend={handleSendAnnouncement}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Message Dialog */}
      <QuickMessageDialog
        open={showMessageDialog}
        onOpenChange={setShowMessageDialog}
        parent={selectedParent}
        onSend={handleSendMessage}
      />
    </BranchLoadingWrapper>
  );
};

export default TeacherCommunicationPage;
