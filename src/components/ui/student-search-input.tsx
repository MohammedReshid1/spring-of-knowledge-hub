import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStudentNames } from '@/hooks/useStudentName';

interface StudentSearchInputProps {
  value: string;
  onChange: (studentId: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
}

export const StudentSearchInput: React.FC<StudentSearchInputProps> = ({
  value,
  onChange,
  label = "Student",
  placeholder = "Type student name or ID",
  required = false
}) => {
  const { students, getStudentName } = useStudentNames();
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedName, setSelectedName] = useState('');

  useEffect(() => {
    // Set initial display name if value exists
    if (value && !searchTerm) {
      const name = getStudentName(value);
      if (name !== value) {
        setSelectedName(name);
        setSearchTerm(name);
      }
    }
  }, [value, getStudentName]);

  // Handle case where students data hasn't loaded yet
  const filteredStudents = students && Array.isArray(students) 
    ? students.filter((student: any) => {
        const search = searchTerm.toLowerCase();
        const fullName = `${student.first_name || ''} ${student.father_name || ''} ${student.grandfather_name || ''}`.toLowerCase();
        const studentId = (student.student_id || '').toLowerCase();
        
        return fullName.includes(search) || studentId.includes(search);
      }).slice(0, 5) // Limit to 5 suggestions
    : [];

  const handleSelect = (student: any) => {
    onChange(student.student_id);
    const name = `${student.first_name || ''} ${student.father_name || ''} ${student.grandfather_name || ''}`.trim();
    setSearchTerm(name);
    setSelectedName(name);
    setShowSuggestions(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowSuggestions(value.length > 0);
    
    // If user clears the input, clear the selection
    if (!value) {
      onChange('');
      setSelectedName('');
    }
  };

  return (
    <div className="relative">
      <Label htmlFor="student-search">{label} {required && '*'}</Label>
      <Input
        id="student-search"
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={() => setShowSuggestions(searchTerm.length > 0)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        placeholder={placeholder}
        required={required}
      />
      
      {value && selectedName && (
        <p className="text-xs text-muted-foreground mt-1">
          Selected: {selectedName} (ID: {value})
        </p>
      )}
      
      {showSuggestions && filteredStudents.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-background border border-input rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredStudents.map((student: any) => (
            <button
              key={student.id}
              type="button"
              onClick={() => handleSelect(student)}
              className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
            >
              <div className="font-medium">
                {student.first_name} {student.father_name} {student.grandfather_name}
              </div>
              <div className="text-sm text-muted-foreground">
                ID: {student.student_id} | Grade: {student.grade_level}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};