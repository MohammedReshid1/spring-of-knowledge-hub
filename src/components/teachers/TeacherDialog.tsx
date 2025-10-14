import React, { useState, useEffect } from 'react';
import { Teacher } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, X } from 'lucide-react';

interface TeacherDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (teacherData: Partial<Teacher>) => void;
  teacher?: Teacher | null;
  isSubmitting?: boolean;
}

export const TeacherDialog: React.FC<TeacherDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  teacher,
  isSubmitting = false
}) => {
  const [formData, setFormData] = useState({
    teacher_id: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    gender: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    qualification: '',
    experience_years: '',
    specialization: '',
    joining_date: '',
    salary: '',
    status: 'Active',
    employee_id: '',
    department: '',
    blood_group: '',
    nationality: '',
    marital_status: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (teacher) {
      setFormData({
        teacher_id: teacher.teacher_id || '',
        first_name: teacher.first_name || '',
        last_name: teacher.last_name || '',
        email: teacher.email || '',
        phone: teacher.phone || '',
        date_of_birth: teacher.date_of_birth || '',
        gender: teacher.gender || '',
        address: teacher.address || '',
        emergency_contact_name: teacher.emergency_contact_name || '',
        emergency_contact_phone: teacher.emergency_contact_phone || '',
        qualification: teacher.qualification || '',
        experience_years: teacher.experience_years?.toString() || '',
        specialization: teacher.specialization || '',
        joining_date: teacher.joining_date || '',
        salary: teacher.salary?.toString() || '',
        status: teacher.status || 'Active',
        employee_id: teacher.employee_id || '',
        department: teacher.department || '',
        blood_group: teacher.blood_group || '',
        nationality: teacher.nationality || '',
        marital_status: teacher.marital_status || '',
        notes: teacher.notes || '',
      });
    } else {
      // Reset form for new teacher
      setFormData({
        teacher_id: '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        date_of_birth: '',
        gender: '',
        address: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        qualification: '',
        experience_years: '',
        specialization: '',
        joining_date: '',
        salary: '',
        status: 'Active',
        employee_id: '',
        department: '',
        blood_group: '',
        nationality: '',
        marital_status: '',
        notes: '',
      });
    }
    setErrors({});
  }, [teacher, isOpen]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.teacher_id.trim()) {
      newErrors.teacher_id = 'Teacher ID is required';
    }
    if (!formData.first_name.trim()) {
      newErrors.first_name = 'First name is required';
    }
    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Last name is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    if (formData.experience_years && isNaN(Number(formData.experience_years))) {
      newErrors.experience_years = 'Experience years must be a number';
    }
    
    if (formData.salary && isNaN(Number(formData.salary))) {
      newErrors.salary = 'Salary must be a number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const teacherData: Partial<Teacher> = {
      teacher_id: formData.teacher_id,
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.email,
      phone: formData.phone || undefined,
      date_of_birth: formData.date_of_birth || undefined,
      gender: formData.gender || undefined,
      address: formData.address || undefined,
      emergency_contact_name: formData.emergency_contact_name || undefined,
      emergency_contact_phone: formData.emergency_contact_phone || undefined,
      qualification: formData.qualification || undefined,
      experience_years: formData.experience_years ? Number(formData.experience_years) : undefined,
      specialization: formData.specialization || undefined,
      joining_date: formData.joining_date || undefined,
      salary: formData.salary ? Number(formData.salary) : undefined,
      status: formData.status,
      employee_id: formData.employee_id || undefined,
      department: formData.department || undefined,
      blood_group: formData.blood_group || undefined,
      nationality: formData.nationality || undefined,
      marital_status: formData.marital_status || undefined,
      notes: formData.notes || undefined,
    };

    onSubmit(teacherData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {teacher ? 'Edit Teacher' : 'Add New Teacher'}
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="teacher_id">Teacher ID *</Label>
              <Input
                id="teacher_id"
                value={formData.teacher_id}
                onChange={(e) => handleInputChange('teacher_id', e.target.value)}
                className={errors.teacher_id ? 'border-red-500' : ''}
                disabled={isSubmitting}
              />
              {errors.teacher_id && (
                <span className="text-red-500 text-sm">{errors.teacher_id}</span>
              )}
            </div>
            
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleInputChange('status', value)}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="On Leave">On Leave</SelectItem>
                  <SelectItem value="Terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="first_name">First Name *</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => handleInputChange('first_name', e.target.value)}
                className={errors.first_name ? 'border-red-500' : ''}
                disabled={isSubmitting}
              />
              {errors.first_name && (
                <span className="text-red-500 text-sm">{errors.first_name}</span>
              )}
            </div>
            
            <div>
              <Label htmlFor="last_name">Last Name *</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => handleInputChange('last_name', e.target.value)}
                className={errors.last_name ? 'border-red-500' : ''}
                disabled={isSubmitting}
              />
              {errors.last_name && (
                <span className="text-red-500 text-sm">{errors.last_name}</span>
              )}
            </div>
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={errors.email ? 'border-red-500' : ''}
                disabled={isSubmitting}
              />
              {errors.email && (
                <span className="text-red-500 text-sm">{errors.email}</span>
              )}
            </div>
            
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Personal Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            
            <div>
              <Label htmlFor="gender">Gender</Label>
              <Select
                value={formData.gender}
                onValueChange={(value) => handleInputChange('gender', value)}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              disabled={isSubmitting}
              rows={2}
            />
          </div>

          {/* Emergency Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
              <Input
                id="emergency_contact_name"
                value={formData.emergency_contact_name}
                onChange={(e) => handleInputChange('emergency_contact_name', e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            
            <div>
              <Label htmlFor="emergency_contact_phone">Emergency Contact Phone</Label>
              <Input
                id="emergency_contact_phone"
                value={formData.emergency_contact_phone}
                onChange={(e) => handleInputChange('emergency_contact_phone', e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Professional Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="qualification">Qualification</Label>
              <Input
                id="qualification"
                value={formData.qualification}
                onChange={(e) => handleInputChange('qualification', e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            
            <div>
              <Label htmlFor="experience_years">Experience (Years)</Label>
              <Input
                id="experience_years"
                type="number"
                value={formData.experience_years}
                onChange={(e) => handleInputChange('experience_years', e.target.value)}
                className={errors.experience_years ? 'border-red-500' : ''}
                disabled={isSubmitting}
              />
              {errors.experience_years && (
                <span className="text-red-500 text-sm">{errors.experience_years}</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="specialization">Specialization</Label>
              <Input
                id="specialization"
                value={formData.specialization}
                onChange={(e) => handleInputChange('specialization', e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            
            <div>
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => handleInputChange('department', e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="joining_date">Joining Date</Label>
              <Input
                id="joining_date"
                type="date"
                value={formData.joining_date}
                onChange={(e) => handleInputChange('joining_date', e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            
            <div>
              <Label htmlFor="salary">Salary</Label>
              <Input
                id="salary"
                type="number"
                step="0.01"
                value={formData.salary}
                onChange={(e) => handleInputChange('salary', e.target.value)}
                className={errors.salary ? 'border-red-500' : ''}
                disabled={isSubmitting}
              />
              {errors.salary && (
                <span className="text-red-500 text-sm">{errors.salary}</span>
              )}
            </div>
          </div>

          {/* Additional Information */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="blood_group">Blood Group</Label>
              <Input
                id="blood_group"
                value={formData.blood_group}
                onChange={(e) => handleInputChange('blood_group', e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            
            <div>
              <Label htmlFor="nationality">Nationality</Label>
              <Input
                id="nationality"
                value={formData.nationality}
                onChange={(e) => handleInputChange('nationality', e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            
            <div>
              <Label htmlFor="marital_status">Marital Status</Label>
              <Select
                value={formData.marital_status}
                onValueChange={(value) => handleInputChange('marital_status', value)}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Single">Single</SelectItem>
                  <SelectItem value="Married">Married</SelectItem>
                  <SelectItem value="Divorced">Divorced</SelectItem>
                  <SelectItem value="Widowed">Widowed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              disabled={isSubmitting}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {teacher ? 'Update Teacher' : 'Add Teacher'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};