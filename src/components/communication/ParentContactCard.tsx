import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Phone,
  Mail,
  MessageSquare,
  User,
  Users,
  MapPin,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Student {
  id: string;
  name: string;
  grade_level: string;
  class_name?: string;
}

interface ParentContact {
  id: string;
  parent_id: string;
  father_name?: string;
  mother_name?: string;
  guardian_name?: string;
  primary_phone?: string;
  secondary_phone?: string;
  email?: string;
  address?: string;
  relationship?: string;
  students: Student[];
}

interface ParentContactCardProps {
  parent: ParentContact;
  onSendMessage?: (parent: ParentContact) => void;
  onCall?: (phone: string) => void;
  onEmail?: (email: string) => void;
  compact?: boolean;
}

export const ParentContactCard: React.FC<ParentContactCardProps> = ({
  parent,
  onSendMessage,
  onCall,
  onEmail,
  compact = false,
}) => {
  const primaryName = parent.father_name || parent.mother_name || parent.guardian_name || 'Unknown Parent';
  const secondaryName = parent.father_name && parent.mother_name
    ? parent.mother_name
    : undefined;

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border hover:border-blue-300 transition-colors">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex-shrink-0">
            <User className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-gray-900 truncate">{primaryName}</p>
            {parent.students.length > 0 && (
              <p className="text-xs text-gray-500 truncate">
                Parent of {parent.students.map(s => s.name).join(', ')}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {parent.primary_phone && onCall && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onCall(parent.primary_phone!)}
              title="Call"
            >
              <Phone className="h-3.5 w-3.5" />
            </Button>
          )}
          {onSendMessage && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onSendMessage(parent)}
              title="Send message"
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className="group relative overflow-hidden border-2 hover:border-blue-300 hover:shadow-lg transition-all duration-300">
      {/* Premium gradient background on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />

      <CardContent className="relative p-6">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex-shrink-0">
            <User className="h-6 w-6 text-blue-600" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Parent Names */}
            <div className="mb-3">
              <h3 className="text-lg font-bold text-gray-900">{primaryName}</h3>
              {secondaryName && (
                <p className="text-sm text-gray-600">{secondaryName}</p>
              )}
              {parent.relationship && (
                <Badge variant="outline" className="mt-1">
                  {parent.relationship}
                </Badge>
              )}
            </div>

            {/* Students */}
            {parent.students.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    Children ({parent.students.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {parent.students.map((student) => (
                    <Badge key={student.id} variant="outline" className="bg-white">
                      {student.name} - {student.grade_level}
                      {student.class_name && ` (${student.class_name})`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Contact Information */}
            <div className="space-y-2 mb-4">
              {parent.primary_phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-700">{parent.primary_phone}</span>
                  {parent.secondary_phone && (
                    <span className="text-gray-500">| {parent.secondary_phone}</span>
                  )}
                </div>
              )}
              {parent.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-700 truncate">{parent.email}</span>
                </div>
              )}
              {parent.address && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-600 line-clamp-1">{parent.address}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              {onSendMessage && (
                <Button
                  variant="default"
                  size="sm"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  onClick={() => onSendMessage(parent)}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
              )}
              {parent.primary_phone && onCall && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCall(parent.primary_phone!)}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </Button>
              )}
              {parent.email && onEmail && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEmail(parent.email!)}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>

      {/* Hover border effect */}
      <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-400/30 rounded-lg pointer-events-none transition-all duration-300" />
    </Card>
  );
};
