import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageSquare,
  Send,
  Search,
  Plus,
  Inbox,
  SendHorizontal,
  Archive,
  Trash2,
  Star,
  Users,
  User,
  Mail,
  MailOpen,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { ComposeMessage } from '@/components/messaging/ComposeMessage';
import { MessageThread } from '@/components/messaging/MessageThread';
import { MessageList } from '@/components/messaging/MessageList';
import { CardLoader, ListLoader } from '@/components/ui/loading-states';
import { Skeleton } from '@/components/ui/skeleton';
import { useLiveData } from '@/hooks/useLiveData';
import { usePermissionCheck } from '@/contexts/RoleAccessContext';

export const MessagingPage: React.FC = () => {
  // Enable real-time updates for messages
  useLiveData(['messages']);

  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('inbox');

  const queryClient = useQueryClient();

  // Permission checks
  const { hasPermission } = usePermissionCheck();
  const canRead = hasPermission('communication.read');
  const canCreate = hasPermission('communication.create');
  const canManage = hasPermission('communication.manage');

  // Fetch messages
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', activeTab],
    queryFn: async () => {
      const response = await apiClient.get(`/communication/messages?message_type=${activeTab}`);
      return response.data;
    },
  });

  // Fetch message stats
  const { data: stats } = useQuery({
    queryKey: ['message-stats'],
    queryFn: async () => {
      const response = await apiClient.get('/communication/messages/stats');
      return response.data;
    },
  });

  const handleMessageSelect = (message: any) => {
    setSelectedMessage(message);
    setShowCompose(false);
  };

  const handleNewMessage = () => {
    setShowCompose(true);
    setSelectedMessage(null);
  };

  const handleCloseCompose = () => {
    setShowCompose(false);
  };

  const handleMessageSent = () => {
    setShowCompose(false);
    queryClient.invalidateQueries({ queryKey: ['messages'] });
    queryClient.invalidateQueries({ queryKey: ['message-stats'] });
    toast.success('Message sent successfully');
  };

  const filteredMessages = messages.filter((msg: any) =>
    msg.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.content?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out;
        }
        .animate-slide-in-right {
          animation: slideInRight 0.6s ease-out;
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
        {/* Premium Hero Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-700 pb-20 pt-16">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/90 via-cyan-600/90 to-teal-700/90" />
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }} />
          </div>

          {/* Enhanced Floating Shapes */}
          <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full animate-pulse" />
          <div className="absolute top-20 right-20 w-16 h-16 bg-white/10 rounded-full animate-pulse delay-1000" />
          <div className="absolute bottom-20 left-1/3 w-12 h-12 bg-white/10 rounded-full animate-pulse delay-500" />
          <div className="absolute top-1/2 left-20 w-8 h-8 bg-white/8 rounded-full animate-pulse delay-300" />
          <div className="absolute top-1/3 right-1/4 w-14 h-14 bg-white/8 rounded-full animate-pulse delay-700" />
          <div className="absolute bottom-1/3 right-10 w-10 h-10 bg-white/8 rounded-full animate-pulse delay-900" />

          <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-8 inline-flex items-center rounded-full bg-white/10 backdrop-blur-sm px-6 py-2 text-sm font-medium text-white/90 ring-1 ring-white/20">
                <MessageSquare className="mr-2 h-4 w-4" />
                Communication Center
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
                Messaging <span className="bg-gradient-to-r from-blue-200 to-cyan-200 bg-clip-text text-transparent">System</span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-blue-100">
                Send and receive messages with students, parents, and staff.
                Stay connected with your school community effortlessly.
              </p>
              {(canCreate || canManage) && (
                <div className="mt-8">
                  <Button onClick={handleNewMessage} className="bg-white text-blue-600 hover:bg-blue-50 gap-2 shadow-lg">
                    <Plus className="h-4 w-4" />
                    Compose New Message
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Wave */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg className="w-full h-20 fill-current text-slate-50" viewBox="0 0 1440 120" preserveAspectRatio="none">
              <path d="M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z" />
            </svg>
          </div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 -mt-10 space-y-6 px-6 pb-16">
          <div className="container mx-auto max-w-7xl space-y-6">

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 animate-fade-in-up">
              <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs md:text-sm text-slate-600 font-medium">Inbox</p>
                      <p className="text-xl md:text-2xl font-bold text-blue-700">{stats?.inbox || 0}</p>
                    </div>
                    <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center shadow-md">
                      <Mail className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]" style={{ animationDelay: '0.1s' }}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs md:text-sm text-slate-600 font-medium">Sent</p>
                      <p className="text-xl md:text-2xl font-bold text-green-700">{stats?.sent || 0}</p>
                    </div>
                    <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center shadow-md">
                      <SendHorizontal className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]" style={{ animationDelay: '0.2s' }}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs md:text-sm text-slate-600 font-medium">Unread</p>
                      <p className="text-xl md:text-2xl font-bold text-red-700">{stats?.unread || 0}</p>
                    </div>
                    <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center shadow-md">
                      <MailOpen className="h-5 w-5 md:h-6 md:w-6 text-red-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]" style={{ animationDelay: '0.3s' }}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs md:text-sm text-slate-600 font-medium">Starred</p>
                      <p className="text-xl md:text-2xl font-bold text-yellow-700">{stats?.starred || 0}</p>
                    </div>
                    <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-gradient-to-br from-yellow-100 to-yellow-200 flex items-center justify-center shadow-md">
                      <Star className="h-5 w-5 md:h-6 md:w-6 text-yellow-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 animate-slide-in-right" style={{ animationDelay: '0.4s' }}>
              {/* Messages List */}
              <Card className="lg:col-span-1 bg-white/80 backdrop-blur-sm border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-4 rounded-none border-b bg-gradient-to-r from-blue-50/50 via-cyan-50/50 to-teal-50/50 border-blue-100">
                <TabsTrigger
                  value="inbox"
                  className="flex items-center gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-100 data-[state=active]:to-cyan-100 data-[state=active]:text-blue-700 data-[state=active]:font-semibold transition-all duration-300 hover:bg-blue-50/50"
                >
                  <Inbox className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Inbox</span>
                </TabsTrigger>
                <TabsTrigger
                  value="sent"
                  className="flex items-center gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-100 data-[state=active]:to-emerald-100 data-[state=active]:text-green-700 data-[state=active]:font-semibold transition-all duration-300 hover:bg-green-50/50"
                >
                  <SendHorizontal className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sent</span>
                </TabsTrigger>
                <TabsTrigger
                  value="starred"
                  className="flex items-center gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-100 data-[state=active]:to-amber-100 data-[state=active]:text-yellow-700 data-[state=active]:font-semibold transition-all duration-300 hover:bg-yellow-50/50"
                >
                  <Star className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Starred</span>
                </TabsTrigger>
                <TabsTrigger
                  value="archived"
                  className="flex items-center gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-100 data-[state=active]:to-gray-100 data-[state=active]:text-slate-700 data-[state=active]:font-semibold transition-all duration-300 hover:bg-slate-50/50"
                >
                  <Archive className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Archive</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value={activeTab} className="mt-0">
                <ScrollArea className="h-[calc(100vh-400px)] md:h-[600px]">
                  <MessageList
                    messages={filteredMessages}
                    selectedMessage={selectedMessage}
                    onSelectMessage={handleMessageSelect}
                    isLoading={isLoading}
                    messageType={activeTab}
                  />
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

              {/* Message Thread or Compose */}
              <Card className="lg:col-span-2 bg-white/80 backdrop-blur-sm border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
          {showCompose ? (
            <ComposeMessage
              onClose={handleCloseCompose}
              onMessageSent={handleMessageSent}
            />
          ) : selectedMessage ? (
            <MessageThread
              message={selectedMessage}
              onClose={() => setSelectedMessage(null)}
              messageType={activeTab}
            />
          ) : (
            <CardContent className="flex items-center justify-center h-[calc(100vh-400px)] md:h-[600px] bg-gradient-to-br from-blue-50/30 via-cyan-50/20 to-teal-50/30">
              <div className="text-center max-w-md px-4">
                <div className="relative mb-6 inline-block">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 rounded-full blur-2xl animate-pulse" />
                  <div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center mx-auto border-2 border-blue-200/50 shadow-lg">
                    <MessageSquare className="h-12 w-12 text-blue-600" />
                  </div>
                </div>
                <h3 className="text-xl md:text-2xl font-bold mb-3 bg-gradient-to-r from-blue-700 to-cyan-700 bg-clip-text text-transparent">No message selected</h3>
                <p className="text-sm text-slate-600 mb-6 font-medium">
                  Select a message from the list{(canCreate || canManage) && ' or compose a new one'} to get started
                </p>
                {(canCreate || canManage) && (
                  <Button
                    onClick={handleNewMessage}
                    className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    <Plus className="h-4 w-4" />
                    Compose New Message
                  </Button>
                )}
              </div>
            </CardContent>
              )}
            </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
