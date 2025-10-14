import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  X,
  Reply,
  Forward,
  Trash2,
  Star,
  Archive,
  Download,
  Send,
  Paperclip,
  Users,
  User,
  Clock,
  CheckCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MessageThreadProps {
  message: any;
  onClose: () => void;
  messageType?: string;
}

export const MessageThread: React.FC<MessageThreadProps> = ({ message, onClose, messageType = 'inbox' }) => {
  const [replyText, setReplyText] = useState('');
  const [showReply, setShowReply] = useState(false);
  const queryClient = useQueryClient();

  const replyMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiClient.post(`/communication/messages/${message.id}/reply`, {
        content
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Reply sent successfully');
      setReplyText('');
      setShowReply(false);
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
    onError: () => {
      toast.error('Failed to send reply');
    }
  });

  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/communication/messages/${message.id}/mark-read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    }
  });

  const toggleStarMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/communication/messages/${message.id}/toggle-star`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['message-stats'] });
      toast.success(data.is_starred ? 'Added to starred' : 'Removed from starred');
    }
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/communication/messages/${message.id}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      toast.success('Message archived');
      onClose();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/communication/messages/${message.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      toast.success('Message deleted');
      onClose();
    }
  });

  React.useEffect(() => {
    // Only mark as read for received messages (inbox), not sent messages
    if (!message.is_read && messageType !== 'sent') {
      markAsReadMutation.mutate();
    }
  }, [message.id, messageType]);

  const handleReply = () => {
    if (!replyText.trim()) {
      toast.error('Please enter a reply message');
      return;
    }
    replyMutation.mutate(replyText);
  };

  return (
    <>
      <CardHeader className="space-y-4 bg-gradient-to-r from-blue-50/30 to-cyan-50/30 border-b border-slate-100/50">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-12 w-12 border-2 border-blue-200/50 shadow-lg">
                <AvatarFallback className="bg-gradient-to-br from-blue-100 to-cyan-100">
                  {message.recipient_type === 'group' ? (
                    <Users className="h-6 w-6 text-blue-600" />
                  ) : (
                    <User className="h-6 w-6 text-blue-600" />
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full border-2 border-white shadow-sm"></div>
            </div>
            <div>
              <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-700 to-cyan-700 bg-clip-text text-transparent">{message.subject}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-slate-600 font-medium">
                  {messageType === 'sent' || message.recipient_names?.length > 0
                    ? `To: ${message.recipient_names?.length > 0 ? message.recipient_names.join(', ') : `${message.recipients?.length || 0} recipient${message.recipients?.length !== 1 ? 's' : ''}`}`
                    : `From: ${message.sender_name || 'Unknown'}`}
                </span>
                {message.sent_at && (
                  <>
                    <span className="text-slate-400">•</span>
                    <span className="text-sm text-slate-600 flex items-center gap-1 font-medium">
                      <Clock className="h-3 w-3 text-blue-600" />
                      {format(new Date(message.sent_at), 'PPp')}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleStarMutation.mutate()}
              className="hover:bg-yellow-50 hover:text-yellow-600 transition-all duration-300"
            >
              <Star className={cn(
                "h-4 w-4",
                message.is_starred && "fill-yellow-400 text-yellow-400"
              )} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => archiveMutation.mutate()}
              className="hover:bg-blue-50 hover:text-blue-600 transition-all duration-300"
            >
              <Archive className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deleteMutation.mutate()}
              className="hover:bg-red-50 hover:text-red-600 transition-all duration-300"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="hover:bg-slate-100 transition-all duration-300"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Premium Priority Badges */}
          {message.priority === 'urgent' && (
            <Badge className="bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border border-red-200/50">Urgent</Badge>
          )}
          {message.priority === 'high' && (
            <Badge className="bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 border border-orange-200/50">High Priority</Badge>
          )}
          {message.priority === 'normal' && (
            <Badge className="bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-800 border border-blue-200/50">Normal Priority</Badge>
          )}
          {message.priority === 'low' && (
            <Badge className="bg-gradient-to-r from-slate-100 to-gray-100 text-slate-800 border border-slate-200/50">Low Priority</Badge>
          )}

          {/* Premium Message Type Badge */}
          {message.message_type && (
            <Badge className="bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-800 border border-purple-200/50">
              {message.message_type.charAt(0).toUpperCase() + message.message_type.slice(1)}
            </Badge>
          )}

          {message.requires_acknowledgment && (
            <Badge className="bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-800 border border-yellow-200/50">Action Required</Badge>
          )}
          {message.recipient_type === 'group' && (
            <Badge className="bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200/50">Group Message</Badge>
          )}
          {message.is_read && (
            <Badge className="bg-gradient-to-r from-teal-100 to-cyan-100 text-teal-800 border border-teal-200/50 gap-1">
              <CheckCheck className="h-3 w-3" />
              Read
            </Badge>
          )}
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="p-6">
            <div className="prose dark:prose-invert max-w-none">
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>

            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Attachments ({message.attachments.length})
                </h4>
                <div className="space-y-2">
                  {message.attachments.map((attachment: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{attachment.name}</p>
                          <p className="text-xs text-muted-foreground">{attachment.size}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator />

        <div className="p-4 space-y-3 bg-gradient-to-r from-blue-50/20 to-cyan-50/20 border-t border-slate-100/50">
          {/* Only show reply/forward buttons for received messages, not sent messages */}
          {messageType !== 'sent' && !showReply ? (
            <div className="flex gap-2">
              <Button
                onClick={() => setShowReply(true)}
                className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Reply className="h-4 w-4 mr-2" />
                Reply
              </Button>
              <Button
                variant="outline"
                className="border-blue-200/50 hover:bg-blue-50 hover:border-blue-400 transition-all duration-300"
              >
                <Forward className="h-4 w-4 mr-2" />
                Forward
              </Button>
            </div>
          ) : messageType !== 'sent' && showReply ? (
            <div className="space-y-3">
              <Textarea
                placeholder="Type your reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={4}
                className="border-blue-200/50 focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-300"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleReply}
                  disabled={replyMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
                >
                  {replyMutation.isPending ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Reply
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowReply(false);
                    setReplyText('');
                  }}
                  className="border-slate-300 hover:bg-slate-50 transition-all duration-300"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </>
  );
};
