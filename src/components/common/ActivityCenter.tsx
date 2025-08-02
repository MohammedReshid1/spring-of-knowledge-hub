import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Activity {
  id: string;
  type: 'import' | 'export' | 'system' | 'student' | 'class' | 'payment' | 'user';
  title: string;
  message: string;
  timestamp: Date;
  severity: 'success' | 'error' | 'info' | 'warning';
  read: boolean;
  data?: any;
  details?: string;
}

const STORAGE_KEY = 'app_activities';
const MAX_ACTIVITIES = 50;

export const ActivityCenter = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  // Load activities from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setActivities(parsed.map((a: any) => ({
          ...a,
          timestamp: new Date(a.timestamp)
        })));
      } catch (error) {
        console.error('Failed to parse stored activities:', error);
      }
    }
  }, []);

  // Save activities to localStorage whenever they change
  useEffect(() => {
    if (activities.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
    }
  }, [activities]);

  // Global function to add activities
  useEffect(() => {
    const addActivity = (activity: Omit<Activity, 'id' | 'timestamp' | 'read'>) => {
      const newActivity: Activity = {
        ...activity,
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        read: false
      };

      setActivities(prev => {
        const updated = [newActivity, ...prev].slice(0, MAX_ACTIVITIES);
        return updated;
      });
    };

    // Make it globally available
    (window as any).addActivity = addActivity;

    return () => {
      delete (window as any).addActivity;
    };
  }, []);

  const unreadCount = activities.filter(a => !a.read).length;

  const markAsRead = (id: string) => {
    setActivities(prev => 
      prev.map(a => a.id === id ? { ...a, read: true } : a)
    );
  };

  const markAllAsRead = () => {
    setActivities(prev => prev.map(a => ({ ...a, read: true })));
  };

  const clearActivity = (id: string) => {
    setActivities(prev => prev.filter(a => a.id !== id));
  };

  const getIcon = (type: Activity['type'], severity: Activity['severity']) => {
    if (severity === 'success') return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (severity === 'error') return <AlertCircle className="h-4 w-4 text-red-600" />;
    if (severity === 'warning') return <AlertCircle className="h-4 w-4 text-yellow-600" />;
    return <Info className="h-4 w-4 text-blue-600" />;
  };

  const formatTime = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 max-h-96 p-0">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Activity Center</CardTitle>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs h-6"
                >
                  Mark all read
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0 max-h-64 overflow-y-auto">
            {activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No activities yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className={cn(
                      "p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors group",
                      !activity.read && "bg-blue-50/50"
                    )}
                    onClick={() => markAsRead(activity.id)}
                  >
                    <div className="flex items-start gap-2">
                      {getIcon(activity.type, activity.severity)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm truncate">
                            {activity.title}
                          </p>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">
                              {formatTime(activity.timestamp)}
                            </span>
                            {activity.details && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedActivity(activity);
                                }}
                                className="h-6 w-6 p-0 text-xs hover:bg-muted"
                              >
                                <Info className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                clearActivity(activity.id);
                              }}
                              className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {activity.message}
                        </p>
                        {!activity.read && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full mt-1" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </DropdownMenuContent>

      {/* Activity Details Dialog */}
      <Dialog open={!!selectedActivity} onOpenChange={() => setSelectedActivity(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedActivity && getIcon(selectedActivity.type, selectedActivity.severity)}
              {selectedActivity?.title}
            </DialogTitle>
          </DialogHeader>
          
          {selectedActivity && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Time</p>
                <p className="text-sm">{selectedActivity.timestamp.toLocaleString()}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-muted-foreground">Message</p>
                <p className="text-sm">{selectedActivity.message}</p>
              </div>
              
              {selectedActivity.details && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Details</p>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap">
                    {selectedActivity.details}
                  </pre>
                </div>
              )}
              
              {selectedActivity.data && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Data</p>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                    {JSON.stringify(selectedActivity.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DropdownMenu>
  );
};

// Helper function to add activities from anywhere in the app
export const addActivity = (activity: Omit<Activity, 'id' | 'timestamp' | 'read'>) => {
  if ((window as any).addActivity) {
    (window as any).addActivity(activity);
  }
};