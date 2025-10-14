import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { User, Users, Circle, Star } from 'lucide-react';

interface MessageListProps {
  messages: any[];
  selectedMessage: any;
  onSelectMessage: (message: any) => void;
  isLoading: boolean;
  messageType?: string;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  selectedMessage,
  onSelectMessage,
  isLoading,
  messageType = 'inbox'
}) => {
  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-start gap-3 p-3 animate-pulse bg-white/50 backdrop-blur-sm rounded-lg">
            <div className="h-10 w-10 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gradient-to-r from-blue-100 to-cyan-100 rounded w-3/4" />
              <div className="h-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-4 rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100 border border-blue-200/50">
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <p className="text-slate-600 font-medium">No messages found</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-blue-100/50">
      {messages.map((message) => (
        <div
          key={message.id}
          onClick={() => onSelectMessage(message)}
          className={cn(
            'flex items-start gap-3 p-3 md:p-4 cursor-pointer transition-all duration-300',
            'hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-cyan-50/50 hover:shadow-md',
            selectedMessage?.id === message.id && 'bg-gradient-to-r from-blue-50 to-cyan-50 shadow-lg border-l-4 border-l-blue-500',
            !message.is_read && !selectedMessage && 'bg-gradient-to-r from-blue-50/70 to-cyan-50/70'
          )}
        >
          <Avatar className="mt-0.5 border-2 border-blue-200/50 shadow-md">
            <AvatarFallback className="bg-gradient-to-br from-blue-100 to-cyan-100">
              {message.recipient_type === 'group' ? (
                <Users className="h-4 w-4 text-blue-600" />
              ) : (
                <User className="h-4 w-4 text-blue-600" />
              )}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn(
                  'font-semibold truncate text-sm',
                  !message.is_read && 'bg-gradient-to-r from-blue-700 to-cyan-700 bg-clip-text text-transparent font-bold'
                )}>
                  {messageType === 'sent' || message.recipient_names?.length > 0
                    ? `To: ${message.recipient_names?.length > 0 ? message.recipient_names.join(', ') : `${message.recipients?.length || 0} recipient${message.recipients?.length !== 1 ? 's' : ''}`}`
                    : message.sender_name || 'Unknown Sender'}
                </span>
                {message.is_starred && (
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 flex-shrink-0 drop-shadow-sm" />
                )}
                {!message.is_read && messageType !== 'sent' && (
                  <Badge className="h-4 px-1.5 text-[10px] flex-shrink-0 bg-gradient-to-r from-blue-600 to-cyan-600 text-white border-0">New</Badge>
                )}
              </div>
              <span className="text-[11px] text-slate-600 whitespace-nowrap flex-shrink-0 font-medium">
                {message.sent_at ? formatDistanceToNow(new Date(message.sent_at), { addSuffix: true }) : 'Not sent'}
              </span>
            </div>
            <p className={cn(
              'text-sm font-medium mb-0.5 truncate',
              !message.is_read && 'text-blue-900 font-semibold'
            )}>
              {message.subject}
            </p>
            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
              {message.content}
            </p>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {message.priority === 'urgent' && (
                <Badge className="text-[10px] h-4 px-1.5 bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border border-red-200/50">Urgent</Badge>
              )}
              {message.priority === 'high' && (
                <Badge className="text-[10px] h-4 px-1.5 bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 border border-orange-200/50">High Priority</Badge>
              )}
              {message.requires_acknowledgment && (
                <Badge className="text-[10px] h-4 px-1.5 bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-800 border border-yellow-200/50">Action Required</Badge>
              )}
              {message.attachments && message.attachments.length > 0 && (
                <Badge className="text-[10px] h-4 px-1.5 bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-800 border border-purple-200/50">
                  {message.attachments.length} Attachment{message.attachments.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
