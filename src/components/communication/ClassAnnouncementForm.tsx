import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Megaphone,
  Send,
  Users,
  AlertCircle,
  Calendar,
  FileText,
  CheckCircle2,
  Mail
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Class {
  id: string;
  name: string;
  grade_level: string;
  subject: string;
  current_enrollment?: number;
}

interface ClassAnnouncementFormProps {
  classes: Class[];
  onSend: (announcementData: {
    class_ids: string[];
    title: string;
    message: string;
    type: string;
    send_email: boolean;
    send_notification: boolean;
  }) => Promise<void>;
}

export const ClassAnnouncementForm: React.FC<ClassAnnouncementFormProps> = ({
  classes,
  onSend,
}) => {
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<string>('general');
  const [sendEmail, setSendEmail] = useState(true);
  const [sendNotification, setSendNotification] = useState(true);
  const [sending, setSending] = useState(false);

  const toggleClass = (classId: string) => {
    setSelectedClasses(prev =>
      prev.includes(classId)
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  };

  const selectAllClasses = () => {
    if (selectedClasses.length === classes.length) {
      setSelectedClasses([]);
    } else {
      setSelectedClasses(classes.map(c => c.id));
    }
  };

  const handleSend = async () => {
    if (selectedClasses.length === 0) {
      toast.error('Please select at least one class');
      return;
    }

    if (!title.trim() || !message.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!sendEmail && !sendNotification) {
      toast.error('Please select at least one delivery method');
      return;
    }

    setSending(true);
    try {
      await onSend({
        class_ids: selectedClasses,
        title: title.trim(),
        message: message.trim(),
        type,
        send_email: sendEmail,
        send_notification: sendNotification,
      });

      const totalParents = selectedClasses.reduce((sum, classId) => {
        const cls = classes.find(c => c.id === classId);
        return sum + (cls?.current_enrollment || 0);
      }, 0);

      toast.success(`Announcement sent to ${totalParents} parents across ${selectedClasses.length} class(es)!`);

      // Reset form
      setSelectedClasses([]);
      setTitle('');
      setMessage('');
      setType('general');
      setSendEmail(true);
      setSendNotification(true);
    } catch (error) {
      toast.error('Failed to send announcement');
      console.error('Error sending announcement:', error);
    } finally {
      setSending(false);
    }
  };

  const announcementTemplates = [
    {
      type: 'general',
      label: 'General Announcement',
      title: 'Class Update',
      message: 'Dear Parents,\n\n[Your announcement here]\n\nBest regards,'
    },
    {
      type: 'exam',
      label: 'Exam Notification',
      title: 'Upcoming Exam',
      message: 'Dear Parents,\n\nThis is to inform you about an upcoming exam...\n\nExam Date: [Date]\nSubject: [Subject]\nTopics: [Topics]\n\nBest regards,'
    },
    {
      type: 'event',
      label: 'Event Announcement',
      title: 'School Event',
      message: 'Dear Parents,\n\nWe are excited to announce an upcoming event...\n\nEvent: [Event Name]\nDate: [Date]\nTime: [Time]\nLocation: [Location]\n\nBest regards,'
    },
    {
      type: 'homework',
      label: 'Homework Reminder',
      title: 'Homework Assignment',
      message: 'Dear Parents,\n\nPlease note the following homework assignment...\n\nAssignment: [Details]\nDue Date: [Date]\n\nBest regards,'
    },
  ];

  const useTemplate = (template: typeof announcementTemplates[0]) => {
    setType(template.type);
    setTitle(template.title);
    setMessage(template.message);
  };

  const totalParents = selectedClasses.reduce((sum, classId) => {
    const cls = classes.find(c => c.id === classId);
    return sum + (cls?.current_enrollment || 0);
  }, 0);

  return (
    <Card className="border-2">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100">
            <Megaphone className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <CardTitle>Send Class Announcement</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Broadcast message to parents of selected classes
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Select Classes */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">
              Select Classes <span className="text-red-500">*</span>
            </Label>
            <Button
              variant="outline"
              size="sm"
              onClick={selectAllClasses}
              className="h-8"
            >
              {selectedClasses.length === classes.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto p-2 bg-gray-50 rounded-lg border">
            {classes.length === 0 ? (
              <div className="col-span-full text-center py-8 text-gray-500">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No classes available</p>
              </div>
            ) : (
              classes.map((cls) => (
                <div
                  key={cls.id}
                  onClick={() => toggleClass(cls.id)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                    selectedClasses.includes(cls.id)
                      ? "border-purple-400 bg-purple-50"
                      : "border-gray-200 hover:border-purple-200 hover:bg-purple-50/50"
                  )}
                >
                  <Checkbox
                    checked={selectedClasses.includes(cls.id)}
                    onCheckedChange={() => toggleClass(cls.id)}
                    className="flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{cls.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {cls.grade_level}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {cls.current_enrollment || 0} students
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedClasses.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <Users className="h-4 w-4 text-purple-600" />
              <span className="text-sm text-purple-900">
                <strong>{totalParents}</strong> parents will receive this announcement across <strong>{selectedClasses.length}</strong> class(es)
              </span>
            </div>
          )}
        </div>

        {/* Templates */}
        <div className="space-y-2">
          <Label>Quick Templates (Optional)</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {announcementTemplates.map((template, idx) => (
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

        {/* Announcement Type */}
        <div className="space-y-2">
          <Label htmlFor="type">Announcement Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  General
                </div>
              </SelectItem>
              <SelectItem value="exam">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Exam/Test
                </div>
              </SelectItem>
              <SelectItem value="event">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Event
                </div>
              </SelectItem>
              <SelectItem value="homework">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Homework
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

        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">
            Title <span className="text-red-500">*</span>
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter announcement title"
            maxLength={100}
          />
          <p className="text-xs text-gray-500">{title.length}/100 characters</p>
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
            placeholder="Type your announcement message here..."
            rows={10}
            maxLength={2000}
          />
          <p className="text-xs text-gray-500">{message.length}/2000 characters</p>
        </div>

        {/* Delivery Options */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Delivery Options</Label>
          <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-3">
              <Checkbox
                id="send-email"
                checked={sendEmail}
                onCheckedChange={(checked) => setSendEmail(checked as boolean)}
              />
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-600" />
                <Label htmlFor="send-email" className="cursor-pointer">
                  Send via Email
                </Label>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id="send-notification"
                checked={sendNotification}
                onCheckedChange={(checked) => setSendNotification(checked as boolean)}
              />
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-gray-600" />
                <Label htmlFor="send-notification" className="cursor-pointer">
                  Send as In-App Notification
                </Label>
              </div>
            </div>
          </div>
        </div>

        {/* Info Note */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800">
            This announcement will be sent to all parents of students in the selected classes.
            Parents will receive the message through their preferred communication channels.
          </p>
        </div>

        {/* Send Button */}
        <Button
          onClick={handleSend}
          disabled={selectedClasses.length === 0 || !title.trim() || !message.trim() || sending}
          className="w-full h-12 text-base bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          size="lg"
        >
          {sending ? (
            <>
              <div className="h-5 w-5 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Sending Announcement...
            </>
          ) : (
            <>
              <Send className="h-5 w-5 mr-2" />
              Send Announcement to {totalParents} Parent{totalParents !== 1 ? 's' : ''}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
