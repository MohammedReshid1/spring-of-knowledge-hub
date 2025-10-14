import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  X,
  Send,
  Paperclip,
  Users,
  User,
  UserCheck,
  GraduationCap,
  BookOpen
} from 'lucide-react';
import { toast } from 'sonner';
import { MultiSelect } from '@/components/ui/multi-select';

interface ComposeMessageProps {
  onClose: () => void;
  onMessageSent: () => void;
}

export const ComposeMessage: React.FC<ComposeMessageProps> = ({ onClose, onMessageSent }) => {
  const [formData, setFormData] = useState({
    subject: '',
    content: '',
    recipient_type: 'individual',
    recipients: [] as string[],
    message_type: 'general',
    priority: 'normal',
    requires_acknowledgment: false,
    class_ids: [] as string[],
    grade_level: '',
  });

  const queryClient = useQueryClient();

  // Fetch users for recipient selection
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await apiClient.get('/users/');
      return response.data;
    },
  });

  // Fetch classes
  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const response = await apiClient.get('/classes/');
      return response.data;
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/communication/messages', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Message sent successfully');
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      onMessageSent();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to send message');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.subject.trim()) {
      toast.error('Subject is required');
      return;
    }

    if (!formData.content.trim()) {
      toast.error('Message content is required');
      return;
    }

    if (formData.recipient_type === 'individual' && formData.recipients.length === 0) {
      toast.error('Please select at least one recipient');
      return;
    }

    if (formData.recipient_type === 'class' && formData.class_ids.length === 0) {
      toast.error('Please select at least one class');
      return;
    }

    if (formData.recipient_type === 'grade' && !formData.grade_level) {
      toast.error('Please select a grade level');
      return;
    }

    sendMessageMutation.mutate(formData);
  };

  const userOptions = users.map((user: any) => ({
    value: user.id,
    label: `${user.full_name || user.email} (${user.role})`
  }));

  const classOptions = classes.map((cls: any) => ({
    value: cls.id,
    label: cls.class_name
  }));

  return (
    <>
      <CardHeader className="border-b border-slate-100/50 pb-4 bg-gradient-to-r from-blue-50/30 to-cyan-50/30">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-xl font-semibold bg-gradient-to-r from-blue-700 to-cyan-700 bg-clip-text text-transparent">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100 border border-blue-200/50">
              <Send className="h-5 w-5 text-blue-600" />
            </div>
            New Message
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-red-50 hover:text-red-600 transition-colors">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Recipient Type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Recipient Type</Label>
            <Select
              value={formData.recipient_type}
              onValueChange={(value) => setFormData({ ...formData, recipient_type: value, recipients: [], class_ids: [], grade_level: '' })}
            >
              <SelectTrigger className="border-blue-200/50 focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Individual Users
                  </div>
                </SelectItem>
                <SelectItem value="all_students">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" />
                    All Students
                  </div>
                </SelectItem>
                <SelectItem value="all_teachers">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    All Teachers
                  </div>
                </SelectItem>
                <SelectItem value="all_parents">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    All Parents
                  </div>
                </SelectItem>
                <SelectItem value="class">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" />
                    Specific Class(es)
                  </div>
                </SelectItem>
                <SelectItem value="grade">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Specific Grade Level
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Recipients Selection */}
          {formData.recipient_type === 'individual' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Select Recipients</Label>
              <MultiSelect
                options={userOptions}
                selected={formData.recipients}
                onChange={(selected) => setFormData({ ...formData, recipients: selected })}
                placeholder="Select users..."
              />
            </div>
          )}

          {formData.recipient_type === 'class' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Select Classes</Label>
              <MultiSelect
                options={classOptions}
                selected={formData.class_ids}
                onChange={(selected) => setFormData({ ...formData, class_ids: selected })}
                placeholder="Select classes..."
              />
            </div>
          )}

          {formData.recipient_type === 'grade' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Select Grade Level</Label>
              <Select
                value={formData.grade_level}
                onValueChange={(value) => setFormData({ ...formData, grade_level: value })}
              >
                <SelectTrigger className="border-blue-200/50 focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-300">
                  <SelectValue placeholder="Select a grade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Kindergarten">Kindergarten</SelectItem>
                  <SelectItem value="Grade 1">Grade 1</SelectItem>
                  <SelectItem value="Grade 2">Grade 2</SelectItem>
                  <SelectItem value="Grade 3">Grade 3</SelectItem>
                  <SelectItem value="Grade 4">Grade 4</SelectItem>
                  <SelectItem value="Grade 5">Grade 5</SelectItem>
                  <SelectItem value="Grade 6">Grade 6</SelectItem>
                  <SelectItem value="Grade 7">Grade 7</SelectItem>
                  <SelectItem value="Grade 8">Grade 8</SelectItem>
                  <SelectItem value="Grade 9">Grade 9</SelectItem>
                  <SelectItem value="Grade 10">Grade 10</SelectItem>
                  <SelectItem value="Grade 11">Grade 11</SelectItem>
                  <SelectItem value="Grade 12">Grade 12</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject" className="text-sm font-medium text-slate-700">Subject *</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Enter message subject"
              className="border-blue-200/50 focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-300"
            />
          </div>

          {/* Message Content */}
          <div className="space-y-2">
            <Label htmlFor="content" className="text-sm font-medium text-slate-700">Message *</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Type your message here..."
              rows={6}
              className="border-blue-200/50 focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-300"
            />
          </div>

          {/* Priority & Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger className="border-blue-200/50 focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Message Type</Label>
              <Select
                value={formData.message_type}
                onValueChange={(value) => setFormData({ ...formData, message_type: value })}
              >
                <SelectTrigger className="border-blue-200/50 focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="academic">Academic</SelectItem>
                  <SelectItem value="administrative">Administrative</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Options */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="acknowledgment"
              checked={formData.requires_acknowledgment}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, requires_acknowledgment: checked as boolean })
              }
            />
            <Label htmlFor="acknowledgment" className="cursor-pointer">
              Require acknowledgment
            </Label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6 border-t border-slate-100 mt-6">
            <Button
              type="submit"
              disabled={sendMessageMutation.isPending}
              className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {sendMessageMutation.isPending ? (
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
                  Send Message
                </>
              )}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="border-slate-300 hover:bg-slate-50 transition-all duration-300">
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </>
  );
};
