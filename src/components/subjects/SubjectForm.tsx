import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { X, Plus, BookOpen, Code, FileText, GraduationCap } from 'lucide-react';
import type { Subject } from '@/types/api';
import type { SubjectCreate } from '@/services/subjectApi';

interface SubjectFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: SubjectCreate) => void;
  initialData?: Subject;
  isLoading?: boolean;
}

const AVAILABLE_GRADE_LEVELS = [
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12'
];

export const SubjectForm: React.FC<SubjectFormProps> = ({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isLoading = false
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch
  } = useForm<SubjectCreate>({
    defaultValues: {
      subject_name: '',
      subject_code: '',
      description: '',
      grade_levels: []
    }
  });

  const selectedGradeLevels = watch('grade_levels') || [];

  useEffect(() => {
    if (initialData) {
      reset({
        subject_name: initialData.subject_name,
        subject_code: initialData.subject_code,
        description: initialData.description || '',
        grade_levels: initialData.grade_levels || []
      });
    } else {
      reset({
        subject_name: '',
        subject_code: '',
        description: '',
        grade_levels: []
      });
    }
  }, [initialData, reset]);

  const handleFormSubmit = (data: SubjectCreate) => {
    onSubmit(data);
  };

  const toggleGradeLevel = (gradeLevel: string) => {
    const current = selectedGradeLevels;
    if (current.includes(gradeLevel)) {
      setValue(
        'grade_levels',
        current.filter((g) => g !== gradeLevel)
      );
    } else {
      setValue('grade_levels', [...current, gradeLevel]);
    }
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-sm border-white/20 shadow-2xl">
        <DialogHeader className="border-b border-slate-100/50 pb-4">
          <DialogTitle className="flex items-center gap-3 text-xl font-semibold bg-gradient-to-r from-purple-700 to-indigo-700 bg-clip-text text-transparent">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 border border-purple-200/50">
              <BookOpen className="h-5 w-5 text-purple-600" />
            </div>
            {initialData ? 'Edit Subject' : 'Create New Subject'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 pt-2">
          {/* Subject Name */}
          <div className="space-y-2">
            <Label htmlFor="subject_name" className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-purple-600" />
              Subject Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="subject_name"
              placeholder="e.g., Mathematics, English Literature"
              {...register('subject_name', {
                required: 'Subject name is required',
                minLength: {
                  value: 2,
                  message: 'Subject name must be at least 2 characters'
                }
              })}
              className={`border-purple-200/50 focus:border-purple-400 focus:ring-purple-400/20 transition-all duration-300 ${errors.subject_name ? 'border-red-500' : ''}`}
            />
            {errors.subject_name && (
              <p className="text-sm text-red-500 mt-1">
                {errors.subject_name.message}
              </p>
            )}
          </div>

          {/* Subject Code */}
          <div className="space-y-2">
            <Label htmlFor="subject_code" className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Code className="h-4 w-4 text-indigo-600" />
              Subject Code <span className="text-red-500">*</span>
            </Label>
            <Input
              id="subject_code"
              placeholder="e.g., MATH101, ENG202"
              {...register('subject_code', {
                required: 'Subject code is required',
                pattern: {
                  value: /^[A-Z0-9]+$/,
                  message: 'Subject code must be uppercase letters and numbers only'
                },
                minLength: {
                  value: 2,
                  message: 'Subject code must be at least 2 characters'
                },
                maxLength: {
                  value: 20,
                  message: 'Subject code must not exceed 20 characters'
                }
              })}
              className={`border-indigo-200/50 focus:border-indigo-400 focus:ring-indigo-400/20 transition-all duration-300 font-mono ${errors.subject_code ? 'border-red-500' : ''}`}
              style={{ textTransform: 'uppercase' }}
            />
            {errors.subject_code && (
              <p className="text-sm text-red-500 mt-1">
                {errors.subject_code.message}
              </p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              Use uppercase letters and numbers only (e.g., MATH101)
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              Description
            </Label>
            <Textarea
              id="description"
              placeholder="Brief description of the subject..."
              rows={3}
              {...register('description')}
              className="border-blue-200/50 focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-300"
            />
            <p className="text-xs text-slate-500 mt-1">Optional</p>
          </div>

          {/* Grade Levels */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-emerald-600" />
              Grade Levels <span className="text-red-500">*</span>
            </Label>
            <p className="text-xs text-slate-500 mb-3">
              Select all grade levels this subject is taught in
            </p>

            {/* Selected Grade Levels */}
            {selectedGradeLevels.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 p-3 bg-gradient-to-br from-emerald-50 to-green-50 rounded-lg border border-emerald-200/50">
                {selectedGradeLevels.map((grade) => (
                  <Badge
                    key={grade}
                    variant="default"
                    className="cursor-pointer bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-sm hover:shadow-md transition-all duration-300"
                    onClick={() => toggleGradeLevel(grade)}
                  >
                    {grade}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
            )}

            {/* Grade Level Selection */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {AVAILABLE_GRADE_LEVELS.map((grade) => {
                const isSelected = selectedGradeLevels.includes(grade);
                return (
                  <Button
                    key={grade}
                    type="button"
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleGradeLevel(grade)}
                    className={`w-full transition-all duration-300 ${
                      isSelected
                        ? 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-md hover:shadow-lg'
                        : 'border-emerald-200/50 hover:border-emerald-400 hover:bg-emerald-50'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <X className="h-3 w-3 mr-1" />
                        {grade}
                      </>
                    ) : (
                      <>
                        <Plus className="h-3 w-3 mr-1" />
                        {grade}
                      </>
                    )}
                  </Button>
                );
              })}
            </div>

            {selectedGradeLevels.length === 0 && (
              <p className="text-sm text-red-500 mt-2">
                Please select at least one grade level
              </p>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className="border-slate-300 hover:bg-slate-50 transition-all duration-300"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || selectedGradeLevels.length === 0}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {initialData ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <BookOpen className="h-4 w-4 mr-2" />
                  {initialData ? 'Update Subject' : 'Create Subject'}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SubjectForm;
