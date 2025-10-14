import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  MessageCircle, 
  Send, 
  Phone,
  Mail,
  Calendar,
  User,
  Users,
  Bell,
  CheckCircle,
  AlertTriangle,
  Clock,
  FileText,
  Video,
  Paperclip
} from 'lucide-react';

interface ParentInfo {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  address?: string;
  relationship: string;
  children: Array<{
    id: string;
    student_id: string;
    full_name: string;
    grade_level: string;
    class_name: string;
  }>;
}

interface MessageThread {
  id: string;
  subject: string;
  participants: Array<{
    id: string;
    name: string;
    role: 'parent' | 'teacher' | 'admin' | 'student';
    avatar?: string;
  }>;
  last_message: {
    content: string;
    sender_name: string;
    timestamp: string;
    is_read: boolean;
  };
  message_count: number;
  unread_count: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'active' | 'closed' | 'archived';
  related_student?: string;
  category: 'general' | 'academic' | 'behavioral' | 'attendance' | 'fees' | 'medical' | 'transport';
}

interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  timestamp: string;
  is_read: boolean;
  attachments?: Array<{
    id: string;
    filename: string;
    size: number;
    type: string;
    url: string;
  }>;
  reactions?: Array<{
    emoji: string;
    count: number;
    users: string[];
  }>;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  category: 'general' | 'academic' | 'event' | 'urgent' | 'policy';
  priority: 'low' | 'normal' | 'high';
  author_name: string;
  author_role: string;
  published_date: string;
  expires_date?: string;
  target_audience: string[];
  acknowledgment_required: boolean;
  is_acknowledged?: boolean;
  attachments?: Array<{
    filename: string;
    url: string;
  }>;
}

interface Props {
  parentInfo: ParentInfo;
}

export const CommunicationCenter: React.FC<Props> = ({ parentInfo }) => {
  const [activeTab, setActiveTab] = useState('messages');
  const [selectedThread, setSelectedThread] = useState<string>('');
  const [newMessage, setNewMessage] = useState('');
  const [newMessageSubject, setNewMessageSubject] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [messageCategory, setMessageCategory] = useState('general');

  const queryClient = useQueryClient();

  const { data: messageThreads, isLoading: threadsLoading } = useQuery({
    queryKey: ['message-threads', parentInfo.id],
    queryFn: async () => {
      const response = await apiClient.get(`/communication/parent-messages/${parentInfo.id}`);
      return response.data as MessageThread[];
    },
  });

  const { data: threadMessages, isLoading: messagesLoading } = useQuery({
    queryKey: ['thread-messages', selectedThread],
    queryFn: async () => {
      if (!selectedThread) return [];
      const response = await apiClient.get(`/communication/messages/${selectedThread}`);
      return response.data as Message[];
    },
    enabled: !!selectedThread,
  });

  const { data: announcements, isLoading: announcementsLoading } = useQuery({
    queryKey: ['announcements', parentInfo.id],
    queryFn: async () => {
      const response = await apiClient.get(`/communication/announcements/parent/${parentInfo.id}`);
      return response.data as Announcement[];
    },
  });

  const { data: teacherContacts } = useQuery({
    queryKey: ['teacher-contacts', parentInfo.id],
    queryFn: async () => {
      const response = await apiClient.get(`/communication/teacher-contacts/${parentInfo.id}`);
      return response.data;
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: any) => {
      const response = await apiClient.post('/communication/send-message', messageData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-threads'] });
      queryClient.invalidateQueries({ queryKey: ['thread-messages'] });
      setNewMessage('');
      setNewMessageSubject('');
    },
  });

  const acknowledgeAnnouncementMutation = useMutation({
    mutationFn: async (announcementId: string) => {
      const response = await apiClient.post(`/communication/announcements/${announcementId}/acknowledge`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'normal': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'academic': return 'bg-blue-100 text-blue-800';
      case 'behavioral': return 'bg-purple-100 text-purple-800';
      case 'attendance': return 'bg-yellow-100 text-yellow-800';
      case 'fees': return 'bg-green-100 text-green-800';
      case 'medical': return 'bg-red-100 text-red-800';
      case 'transport': return 'bg-indigo-100 text-indigo-800';
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'event': return 'bg-purple-100 text-purple-800';
      case 'policy': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleSendMessage = () => {
    if (selectedThread) {
      // Reply to existing thread
      sendMessageMutation.mutate({
        thread_id: selectedThread,
        content: newMessage,
        parent_id: parentInfo.id,
      });
    } else {
      // Create new message
      sendMessageMutation.mutate({
        subject: newMessageSubject,
        content: newMessage,
        recipient_id: selectedRecipient,
        category: messageCategory,
        parent_id: parentInfo.id,
      });
    }
  };

  const unreadCount = messageThreads?.reduce((count, thread) => count + thread.unread_count, 0) || 0;
  const unacknowledgedAnnouncements = announcements?.filter(a => a.acknowledgment_required && !a.is_acknowledged).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Communication Center</h2>
          <p className="text-muted-foreground">Stay connected with teachers and school administration</p>
        </div>
        
        <div className="flex space-x-2">
          {unreadCount > 0 && (
            <Badge className="bg-red-100 text-red-800">
              {unreadCount} unread messages
            </Badge>
          )}
          {unacknowledgedAnnouncements > 0 && (
            <Badge className="bg-yellow-100 text-yellow-800">
              {unacknowledgedAnnouncements} pending acknowledgments
            </Badge>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="messages" className="relative">
            Messages
            {unreadCount > 0 && (
              <Badge className="ml-2 bg-red-500 text-white text-xs px-1 py-0">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="compose">Compose</TabsTrigger>
          <TabsTrigger value="announcements" className="relative">
            Announcements
            {unacknowledgedAnnouncements > 0 && (
              <Badge className="ml-2 bg-yellow-500 text-white text-xs px-1 py-0">
                {unacknowledgedAnnouncements}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Message Threads List */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MessageCircle className="h-5 w-5 mr-2" />
                    Message Threads
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {threadsLoading ? (
                    <div className="text-center py-4">Loading messages...</div>
                  ) : messageThreads && messageThreads.length > 0 ? (
                    <div className="space-y-2">
                      {messageThreads.map((thread) => (
                        <div
                          key={thread.id}
                          onClick={() => setSelectedThread(thread.id)}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedThread === thread.id 
                              ? 'bg-blue-50 border-blue-200' 
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium text-sm line-clamp-1">{thread.subject}</h4>
                            {thread.unread_count > 0 && (
                              <Badge className="bg-blue-100 text-blue-800 text-xs">
                                {thread.unread_count}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge className={getCategoryColor(thread.category)} variant="outline">
                              {thread.category}
                            </Badge>
                            <Badge className={getPriorityColor(thread.priority)} variant="outline">
                              {thread.priority}
                            </Badge>
                          </div>
                          
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                            {thread.last_message.content}
                          </p>
                          
                          <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span>{thread.last_message.sender_name}</span>
                            <span>{formatDate(thread.last_message.timestamp)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No messages yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Message Thread View */}
            <div className="lg:col-span-2">
              {selectedThread ? (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {messageThreads?.find(t => t.id === selectedThread)?.subject}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
                      {messagesLoading ? (
                        <div className="text-center py-4">Loading messages...</div>
                      ) : threadMessages && threadMessages.length > 0 ? (
                        threadMessages.map((message) => (
                          <div
                            key={message.id}
                            className={`p-3 rounded-lg ${
                              message.sender_role === 'parent' 
                                ? 'bg-blue-50 ml-8' 
                                : 'bg-gray-50 mr-8'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-sm">{message.sender_name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {message.sender_role}
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {formatDateTime(message.timestamp)}
                              </span>
                            </div>
                            
                            <p className="text-sm">{message.content}</p>
                            
                            {message.attachments && message.attachments.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {message.attachments.map((attachment) => (
                                  <div key={attachment.id} className="flex items-center space-x-2 text-xs">
                                    <Paperclip className="h-3 w-3" />
                                    <span>{attachment.filename}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-sm text-muted-foreground">No messages in this thread</p>
                        </div>
                      )}
                    </div>

                    {/* Reply Box */}
                    <div className="border-t pt-4">
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Type your reply..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          rows={3}
                        />
                        <div className="flex justify-between items-center">
                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm">
                              <Paperclip className="h-4 w-4" />
                            </Button>
                          </div>
                          <Button 
                            onClick={handleSendMessage}
                            disabled={!newMessage.trim() || sendMessageMutation.isPending}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Send Reply
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="text-center py-12">
                    <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Select a message thread to view the conversation</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="compose" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Send className="h-5 w-5 mr-2" />
                Compose New Message
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="recipient">Recipient</Label>
                    <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select recipient" />
                      </SelectTrigger>
                      <SelectContent>
                        {teacherContacts?.teachers?.map((teacher: any) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.full_name} - {teacher.subject}
                          </SelectItem>
                        ))}
                        {teacherContacts?.admin?.map((admin: any) => (
                          <SelectItem key={admin.id} value={admin.id}>
                            {admin.full_name} - {admin.role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select value={messageCategory} onValueChange={setMessageCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="academic">Academic</SelectItem>
                        <SelectItem value="behavioral">Behavioral</SelectItem>
                        <SelectItem value="attendance">Attendance</SelectItem>
                        <SelectItem value="fees">Fees</SelectItem>
                        <SelectItem value="medical">Medical</SelectItem>
                        <SelectItem value="transport">Transport</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={newMessageSubject}
                    onChange={(e) => setNewMessageSubject(e.target.value)}
                    placeholder="Enter message subject"
                  />
                </div>

                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message here..."
                    rows={6}
                  />
                </div>

                <div className="flex justify-between items-center">
                  <Button variant="outline">
                    <Paperclip className="h-4 w-4 mr-2" />
                    Attach File
                  </Button>
                  <Button 
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || !newMessageSubject.trim() || !selectedRecipient || sendMessageMutation.isPending}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send Message
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="announcements" className="space-y-6">
          {announcementsLoading ? (
            <div className="text-center py-8">Loading announcements...</div>
          ) : announcements && announcements.length > 0 ? (
            <div className="space-y-4">
              {announcements.map((announcement) => (
                <Card key={announcement.id} className={
                  announcement.acknowledgment_required && !announcement.is_acknowledged
                    ? 'border-yellow-200 bg-yellow-50'
                    : ''
                }>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-semibold text-lg">{announcement.title}</h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge className={getCategoryColor(announcement.category)}>
                            {announcement.category}
                          </Badge>
                          <Badge className={getPriorityColor(announcement.priority)}>
                            {announcement.priority}
                          </Badge>
                          {announcement.acknowledgment_required && !announcement.is_acknowledged && (
                            <Badge className="bg-yellow-100 text-yellow-800">
                              Acknowledgment Required
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right text-sm text-muted-foreground">
                        <p>By {announcement.author_name}</p>
                        <p>{formatDate(announcement.published_date)}</p>
                        {announcement.expires_date && (
                          <p>Expires: {formatDate(announcement.expires_date)}</p>
                        )}
                      </div>
                    </div>

                    <div className="prose prose-sm max-w-none mb-4">
                      <p>{announcement.content}</p>
                    </div>

                    {announcement.attachments && announcement.attachments.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-medium mb-2">Attachments:</h4>
                        <div className="space-y-1">
                          {announcement.attachments.map((attachment, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <FileText className="h-4 w-4" />
                              <a 
                                href={attachment.url} 
                                className="text-blue-600 hover:underline text-sm"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {attachment.filename}
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {announcement.acknowledgment_required && !announcement.is_acknowledged && (
                      <Button 
                        onClick={() => acknowledgeAnnouncementMutation.mutate(announcement.id)}
                        disabled={acknowledgeAnnouncementMutation.isPending}
                        className="w-full"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Acknowledge
                      </Button>
                    )}

                    {announcement.is_acknowledged && (
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        <span className="text-sm">Acknowledged</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No announcements available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="contacts" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Teachers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Teachers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {teacherContacts?.teachers ? (
                  <div className="space-y-4">
                    {teacherContacts.teachers.map((teacher: any) => (
                      <div key={teacher.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div>
                          <p className="font-medium">{teacher.full_name}</p>
                          <p className="text-sm text-muted-foreground">{teacher.subject}</p>
                          {teacher.email && (
                            <p className="text-sm text-muted-foreground">{teacher.email}</p>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm">
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          {teacher.phone && (
                            <Button variant="outline" size="sm">
                              <Phone className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <User className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No teacher contacts available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Administration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Administration
                </CardTitle>
              </CardHeader>
              <CardContent>
                {teacherContacts?.admin ? (
                  <div className="space-y-4">
                    {teacherContacts.admin.map((admin: any) => (
                      <div key={admin.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div>
                          <p className="font-medium">{admin.full_name}</p>
                          <p className="text-sm text-muted-foreground">{admin.role}</p>
                          {admin.email && (
                            <p className="text-sm text-muted-foreground">{admin.email}</p>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm">
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          {admin.phone && (
                            <Button variant="outline" size="sm">
                              <Phone className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <User className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No admin contacts available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};