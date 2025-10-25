import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  MessageSquare,
  Send,
  Users,
  X,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface Student {
  id: string;
  name: string;
  grade_level: string;
}

interface ParentContact {
  id: string;
  father_name?: string;
  mother_name?: string;
  guardian_name?: string;
  email?: string;
  students: Student[];
}

interface QuickMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent?: ParentContact;
  onSend: (messageData: {
    parent_id: string;
    subject: string;
    message: string;
    priority: string;
    regarding_student?: string;
  }) => Promise<void>;
}

export const QuickMessageDialog: React.FC<QuickMessageDialogProps> = ({
  open,
  onOpenChange,
  parent,
  onSend,
}) => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [regardingStudent, setRegardingStudent] = useState<string>('');
  const [sending, setSending] = useState(false);

  const parentName = parent?.father_name || parent?.mother_name || parent?.guardian_name || 'Parent';

  const handleSend = async () => {
    if (!parent || !subject.trim() || !message.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSending(true);
    try {
      await onSend({
        parent_id: parent.id,
        subject: subject.trim(),
        message: message.trim(),
        priority,
        regarding_student: regardingStudent || undefined,
      });

      toast.success('Message sent successfully!');
      handleClose();
    } catch (error) {
      toast.error('Failed to send message');
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setSubject('');
    setMessage('');
    setPriority('normal');
    setRegardingStudent('');
    onOpenChange(false);
  };

  const messageTemplates = [
    {
      label: 'Academic Progress Update',
      subject: 'Academic Progress Update',
      message: `Dear ${parentName},\n\nI wanted to take a moment to update you on your child's academic progress...\n\nBest regards,`
    },
    {
      label: 'Attendance Concern',
      subject: 'Attendance Discussion',
      message: `Dear ${parentName},\n\nI'd like to discuss your child's recent attendance...\n\nBest regards,`
    },
    {
      label: 'Positive Behavior',
      subject: 'Positive Behavior Recognition',
      message: `Dear ${parentName},\n\nI wanted to share some positive news about your child...\n\nBest regards,`
    },
    {
      label: 'Assignment Reminder',
      subject: 'Assignment Reminder',
      message: `Dear ${parentName},\n\nThis is a friendly reminder about an upcoming assignment...\n\nBest regards,`
    },
  ];

  const useTemplate = (template: typeof messageTemplates[0]) => {
    setSubject(template.subject);
    setMessage(template.message);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle>Send Message to Parent</DialogTitle>
              <DialogDescription>
                Send a message to {parentName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Parent Info */}
          {parent && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Recipient</span>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-900">{parentName}</p>
                {parent.email && (
                  <p className="text-xs text-gray-600">{parent.email}</p>
                )}
                {parent.students.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {parent.students.map((student) => (
                      <Badge key={student.id} variant="outline" className="text-xs">
                        {student.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Message Templates */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Quick Templates (Optional)
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {messageTemplates.map((template, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => useTemplate(template)}
                  className="justify-start text-left text-xs h-auto py-2"
                >
                  {template.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Regarding Student */}
          {parent && parent.students.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="student">Regarding Student (Optional)</Label>
              <Select value={regardingStudent} onValueChange={setRegardingStudent}>
                <SelectTrigger id="student">
                  <SelectValue placeholder="Select student (if specific)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All students</SelectItem>
                  {parent.students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.name} - {student.grade_level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Normal
                  </div>
                </SelectItem>
                <SelectItem value="urgent">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    Urgent
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">
              Subject <span className="text-red-500">*</span>
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter message subject"
              maxLength={100}
            />
            <p className="text-xs text-gray-500">{subject.length}/100 characters</p>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">
              Message <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              rows={8}
              maxLength={1000}
            />
            <p className="text-xs text-gray-500">{message.length}/1000 characters</p>
          </div>

          {/* Info Note */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Messages will be sent via email and app notification. Parent will be able to reply through the messaging system.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={sending}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!subject.trim() || !message.trim() || sending}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            {sending ? (
              <>
                <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Message
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
