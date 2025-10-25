import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Filter, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Class {
  id: string;
  name: string;
  grade_level: string;
  subject?: string;
}

interface Subject {
  id: string;
  name: string;
}

interface TeacherAttendanceFiltersProps {
  classes: Class[];
  subjects: Subject[];
  selectedClass: string;
  selectedSubject: string;
  selectedDate: Date;
  onClassChange: (classId: string) => void;
  onSubjectChange: (subjectId: string) => void;
  onDateChange: (date: Date) => void;
  onClearFilters: () => void;
}

export const TeacherAttendanceFilters: React.FC<TeacherAttendanceFiltersProps> = ({
  classes,
  subjects,
  selectedClass,
  selectedSubject,
  selectedDate,
  onClassChange,
  onSubjectChange,
  onDateChange,
  onClearFilters,
}) => {
  const hasActiveFilters = selectedClass || selectedSubject;

  return (
    <Card className="border-blue-200/50 shadow-lg">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-slate-900">Quick Filters</h3>
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="text-slate-600 hover:text-slate-900"
            >
              <X className="h-4 w-4 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Class Filter */}
          <div className="space-y-2">
            <Label htmlFor="class-filter" className="text-sm font-medium text-slate-700">
              Class
            </Label>
            <Select value={selectedClass} onValueChange={onClassChange}>
              <SelectTrigger
                id="class-filter"
                className={cn(
                  "w-full bg-white border-slate-300 hover:border-blue-400 transition-colors",
                  selectedClass && "border-blue-500 ring-1 ring-blue-100"
                )}
              >
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{cls.name}</span>
                      <span className="text-xs text-slate-500">
                        Grade {cls.grade_level}
                        {cls.subject && ` - ${cls.subject}`}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject Filter */}
          <div className="space-y-2">
            <Label htmlFor="subject-filter" className="text-sm font-medium text-slate-700">
              Subject
            </Label>
            <Select value={selectedSubject} onValueChange={onSubjectChange}>
              <SelectTrigger
                id="subject-filter"
                className={cn(
                  "w-full bg-white border-slate-300 hover:border-blue-400 transition-colors",
                  selectedSubject && "border-blue-500 ring-1 ring-blue-100"
                )}
              >
                <SelectValue placeholder="All subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Picker */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal bg-white border-slate-300 hover:border-blue-400 transition-colors",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && onDateChange(date)}
                  disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Active Filters Indicator */}
        {hasActiveFilters && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex flex-wrap gap-2">
              {selectedClass && (
                <div className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                  <span className="font-medium">Class:</span>
                  <span>{classes.find(c => c.id === selectedClass)?.name}</span>
                  <button
                    onClick={() => onClassChange('')}
                    className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {selectedSubject && selectedSubject !== 'all' && (
                <div className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                  <span className="font-medium">Subject:</span>
                  <span>{subjects.find(s => s.id === selectedSubject)?.name}</span>
                  <button
                    onClick={() => onSubjectChange('all')}
                    className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
