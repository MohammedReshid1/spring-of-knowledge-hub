import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Bell,
  BarChart3,
  Search,
  Check,
  CheckCheck,
  Clock,
  AlertTriangle,
  MessageCircle,
  Calendar,
  Users,
  FileText,
  DollarSign,
  GraduationCap,
  RefreshCw,
  Filter,
  MoreVertical,
  ExternalLink,
  Archive,
  Trash2,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Loader2,
  Settings,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { useNotifications } from '@/contexts/NotificationContext';
import { ConnectionStatus } from '@/hooks/useWebSocket';

interface UserNotification {
  id: string;
  notification_code: string;
  title: string;
  message: string;
  notification_type: string;
  priority: string;
  sender_name: string;
  sender_role: string;
  created_at: string;
  recipient_status: string;
  read_at?: string;
  clicked: boolean;
  action_url?: string;
  action_text?: string;
}

interface NotificationCenterProps {
  userId?: string;
  showHeader?: boolean;
  maxHeight?: string;
  enableSound?: boolean;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  userId,
  showHeader = true,
  maxHeight = "600px",
  enableSound = true
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightedId = searchParams.get('id');
  const notificationRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const [searchTerm, setSearchTerm] = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [showSystemAlerts, setShowSystemAlerts] = useState(true);
  const [activeTab, setActiveTab] = useState('notifications');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const queryClient = useQueryClient();

  // Scroll to and highlight notification when navigating from bell
  useEffect(() => {
    if (highlightedId && notificationRefs.current[highlightedId]) {
      // Scroll to the notification
      notificationRefs.current[highlightedId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      // Remove the query parameter after scrolling
      setTimeout(() => {
        setSearchParams({});
      }, 2000);
    }
  }, [highlightedId, setSearchParams]);

  // Use the notification context
  const {
    notifications,
    systemAlerts,
    unreadCount,
    connectionStatus,
    isConnected,
    isAuthenticated,
    soundEnabled,
    stats,
    markAsRead,
    markAllAsRead,
    markAsClicked,
    dismissAlert,
    toggleSound,
    reconnect,
    disconnect,
    connectionId
  } = useNotifications();

  // Fallback to API data when WebSocket is not available
  const { data: apiResponse, isLoading: isLoadingApi, refetch } = useQuery({
    queryKey: ['user-notifications', showUnreadOnly, filterType, filterPriority],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (showUnreadOnly) params.append('unread_only', 'true');

      const response = await apiClient.get(`/api/notifications/user-notifications?${params}`);
      return response.data;
    },
    refetchInterval: isConnected ? false : 30000, // Only refetch via API when WebSocket disconnected
    enabled: !isConnected, // Only fetch when WebSocket is not connected
  });

  // Extract notifications array from API response
  const apiNotifications = Array.isArray(apiResponse) ? apiResponse : (apiResponse?.notifications || []);

  // API mutations for when WebSocket is not available
  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await apiClient.post(`/api/notifications/mark-read/${notificationId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-notifications'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to mark notification as read');
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/api/notifications/mark-all-read');
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['user-notifications'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to mark all notifications as read');
    },
  });

  // Handle mark as read - use WebSocket when available, API otherwise
  const handleMarkAsRead = (notificationId: string) => {
    if (isConnected) {
      markAsRead(notificationId);
    } else {
      markReadMutation.mutate(notificationId);
    }
  };

  // Handle mark all as read
  const handleMarkAllAsRead = () => {
    if (isConnected) {
      markAllAsRead();
    } else {
      markAllReadMutation.mutate();
    }
  };

  // Convert API notifications to context format when WebSocket is not available
  const displayNotifications = useMemo(() => {
    if (isConnected) {
      return notifications;
    } else {
      return apiNotifications.map(apiNotif => ({
        id: apiNotif.id,
        type: apiNotif.notification_type,
        title: apiNotif.title,
        message: apiNotif.message,
        priority: apiNotif.priority as 'low' | 'medium' | 'high' | 'urgent',
        category: apiNotif.notification_type,
        timestamp: apiNotif.created_at,
        read: !!apiNotif.read_at,
        clicked: apiNotif.clicked,
        action_url: apiNotif.action_url,
        action_text: apiNotif.action_text,
        sender_name: apiNotif.sender_name,
        sender_role: apiNotif.sender_role
      }));
    }
  }, [isConnected, notifications, apiNotifications]);

  // Filter notifications based on search and filters
  const allFilteredNotifications = useMemo(() => {
    return displayNotifications.filter(notification => {
      const matchesSearch = !searchTerm ||
        notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        notification.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        notification.sender_name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesUnread = !showUnreadOnly || !notification.read;
      const matchesType = filterType === 'all' || notification.type === filterType;
      const matchesPriority = filterPriority === 'all' || notification.priority === filterPriority;

      return matchesSearch && matchesUnread && matchesType && matchesPriority;
    });
  }, [displayNotifications, searchTerm, showUnreadOnly, filterType, filterPriority]);

  // Calculate pagination values
  const totalPages = Math.ceil(allFilteredNotifications.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const filteredNotifications = allFilteredNotifications.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, showUnreadOnly, filterType, filterPriority]);

  const displayUnreadCount = isConnected ? unreadCount : apiNotifications.filter(n => !n.read_at).length;
  const isLoading = isLoadingApi && !isConnected;

  const getNotificationIcon = (type: string) => {
    const iconProps = { className: "h-4 w-4" };
    switch (type) {
      case 'announcement': return <MessageCircle {...iconProps} />;
      case 'emergency': return <AlertTriangle {...iconProps} />;
      case 'event': return <Calendar {...iconProps} />;
      case 'academic': return <GraduationCap {...iconProps} />;
      case 'payment_reminder': return <DollarSign {...iconProps} />;
      case 'exam_notification': return <FileText {...iconProps} />;
      default: return <Bell {...iconProps} />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'emergency': return 'bg-red-100 text-red-800';
      case 'announcement': return 'bg-blue-100 text-blue-800';
      case 'event': return 'bg-purple-100 text-purple-800';
      case 'academic': return 'bg-green-100 text-green-800';
      case 'payment_reminder': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;

    // Show actual date for older notifications
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getConnectionStatusBadge = () => {
    switch (connectionStatus) {
      case ConnectionStatus.CONNECTED:
      case ConnectionStatus.AUTHENTICATED:
        return (
          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
            <Wifi className="h-3 w-3 mr-1" />
            Live
          </Badge>
        );
      case ConnectionStatus.CONNECTING:
      case ConnectionStatus.AUTHENTICATING:
        return (
          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Connecting
          </Badge>
        );
      case ConnectionStatus.RECONNECTING:
        return (
          <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            Reconnecting
          </Badge>
        );
      case ConnectionStatus.ERROR:
        return (
          <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
            <WifiOff className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">
            <WifiOff className="h-3 w-3 mr-1" />
            Offline
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-8 w-8 mx-auto animate-spin mb-4" />
        <p>Loading notifications...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Alerts */}
      {systemAlerts.length > 0 && showSystemAlerts && (
        <div className="space-y-2">
          {systemAlerts.map((alert) => (
            <Alert key={alert.id} className={`border-l-4 ${
              alert.type === 'error' ? 'border-red-500 bg-red-50' :
              alert.type === 'warning' ? 'border-yellow-500 bg-yellow-50' :
              alert.type === 'success' ? 'border-green-500 bg-green-50' :
              'border-blue-500 bg-blue-50'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-2">
                  {alert.type === 'error' && <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />}
                  {alert.type === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />}
                  {alert.type === 'success' && <Check className="h-4 w-4 text-green-500 mt-0.5" />}
                  {alert.type === 'info' && <MessageCircle className="h-4 w-4 text-blue-500 mt-0.5" />}
                  <div>
                    <h4 className="font-medium">{alert.title}</h4>
                    <AlertDescription className="text-sm">{alert.message}</AlertDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dismissAlert(alert.id)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Alert>
          ))}
        </div>
      )}

      {/* Premium Header */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl font-bold flex items-center gap-3 bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                  <Bell className="h-6 w-6 text-blue-600" />
                </div>
                Notification Center
                {displayUnreadCount > 0 && (
                  <Badge className="bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border border-red-200/50">{displayUnreadCount} unread</Badge>
                )}
                <div className="ml-3">
                  {getConnectionStatusBadge()}
                </div>
              </CardTitle>
              <div className="flex items-center gap-4 text-slate-600 font-medium mt-2">
                <p>Stay updated with the latest announcements and alerts</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSound}
                title={soundEnabled ? 'Disable sounds' : 'Enable sounds'}
                className="border-blue-200/50 hover:bg-blue-50 hover:border-blue-400 transition-all duration-300"
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>

              {!isConnected && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={reconnect}
                  className="border-blue-200/50 hover:bg-blue-50 hover:border-blue-400 transition-all duration-300"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reconnect
                </Button>
              )}

  
              {displayUnreadCount > 0 && (
                <Button
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  disabled={markAllReadMutation.isPending}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <CheckCheck className="h-4 w-4 mr-2" />
                  Mark All Read
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Premium Filters and Search */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg">
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap items-center">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search notifications..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-blue-200/50 focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-300"
                />
              </div>
            </div>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40 border-blue-200/50 focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-300">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="announcement">Announcements</SelectItem>
                <SelectItem value="academic">Academic</SelectItem>
                <SelectItem value="payment_reminder">Payment</SelectItem>
                <SelectItem value="event">Events</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-32 border-blue-200/50 focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-300">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={showUnreadOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              className={showUnreadOnly
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                : "border-blue-200/50 hover:bg-blue-50 hover:border-blue-400 transition-all duration-300"
              }
            >
              {showUnreadOnly ? 'Show All' : 'Unread Only'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Premium Notifications List */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
        <CardContent className="p-0">
          <ScrollArea className={`h-[${maxHeight}]`}>
            {filteredNotifications.length > 0 ? (
              <div className="divide-y">
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    ref={(el) => (notificationRefs.current[notification.id] = el)}
                    className={`p-4 hover:bg-gray-50 transition-all duration-300 ${
                      !notification.read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    } ${
                      highlightedId === notification.id ? 'ring-2 ring-yellow-400 bg-yellow-50 animate-pulse' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-4">
                      <div className={`flex-shrink-0 p-2 rounded-full ${getTypeColor(notification.type)}`}>
                        {getNotificationIcon(notification.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="text-sm font-semibold text-gray-900 truncate">
                                {notification.title}
                              </h4>
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${getPriorityColor(notification.priority)}`}
                              >
                                {notification.priority}
                              </Badge>
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${getTypeColor(notification.type)}`}
                              >
                                {notification.category.replace('_', ' ')}
                              </Badge>
                            </div>
                            
                            <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                              {notification.message}
                            </p>

                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              {notification.sender_name && (
                                <span className="flex items-center">
                                  <Users className="h-3 w-3 mr-1" />
                                  {notification.sender_name}
                                  {notification.sender_role && ` (${notification.sender_role})`}
                                </span>
                              )}
                              <span className="flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                {formatTimeAgo(notification.timestamp)}
                              </span>
                              {isConnected && (
                                <span className="text-green-600 font-medium">Live</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 ml-4">
                            {!notification.read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkAsRead(notification.id)}
                                disabled={markReadMutation.isPending}
                                title="Mark as read"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            
                            {notification.read && (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                                Read
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Action Button */}
                        {notification.action_url && notification.action_text && (
                          <div className="mt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                markAsClicked(notification.id);
                                window.open(notification.action_url, '_blank');
                              }}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              {notification.action_text}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchTerm 
                    ? 'No notifications match your search'
                    : showUnreadOnly 
                    ? 'No unread notifications'
                    : 'No notifications yet'
                  }
                </p>
                {searchTerm && (
                  <Button
                    variant="link"
                    className="mt-2"
                    onClick={() => setSearchTerm('')}
                  >
                    Clear search
                  </Button>
                )}
                {!isConnected && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      Real-time notifications are currently offline
                    </p>
                    <Button variant="outline" size="sm" onClick={reconnect}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Try Reconnect
                    </Button>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1}-{Math.min(endIndex, allFilteredNotifications.length)} of {allFilteredNotifications.length} notifications
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>

            <div className="flex items-center space-x-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                // Show first page, last page, current page, and pages around current
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <Button
                      key={page}
                      variant={page === currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="w-10"
                    >
                      {page}
                    </Button>
                  );
                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return <span key={page} className="px-2">...</span>;
                }
                return null;
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Premium Enhanced Summary Card with Real-time Stats */}
      {(displayNotifications.length > 0 || isConnected) && (
        <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b border-slate-100/50">
            <CardTitle className="text-lg font-semibold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent flex items-center gap-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                <BarChart3 className="h-4 w-4 text-blue-600" />
              </div>
              Notification Summary
            </CardTitle>
            <div className="flex items-center space-x-2">
              {isConnected ? (
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                  <Wifi className="h-3 w-3 mr-1" />
                  Real-time
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">
                  <WifiOff className="h-3 w-3 mr-1" />
                  Offline
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center">
                <div className="text-lg font-bold">
                  {isConnected ? stats.total : displayNotifications.length}
                </div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-red-600">
                  {isConnected ? stats.unread : displayNotifications.filter(n => !n.read).length}
                </div>
                <div className="text-xs text-muted-foreground">Unread</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">
                  {isConnected ? (stats.total - stats.unread) : displayNotifications.filter(n => n.read).length}
                </div>
                <div className="text-xs text-muted-foreground">Read</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">
                  {isConnected ? stats.today : displayNotifications.filter(n => {
                    const today = new Date().toDateString();
                    return new Date(n.timestamp).toDateString() === today;
                  }).length}
                </div>
                <div className="text-xs text-muted-foreground">{isConnected ? 'Today' : 'Clicked'}</div>
              </div>
            </div>

            {/* Additional Real-time Stats */}
            {isConnected && (
              <div className="mt-4 pt-4 border-t">
                <div className="grid gap-4 md:grid-cols-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">High Priority:</span>
                    <span className="font-medium text-orange-600">{stats.highPriority}</span>
                  </div>
                    <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Sound:</span>
                    <Button variant="ghost" size="sm" onClick={toggleSound} className="h-6 p-1">
                      {soundEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};