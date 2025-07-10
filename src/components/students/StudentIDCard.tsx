
import { Card, CardContent } from '@/components/ui/card';
import { useState } from 'react';

interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  grade_level: string;
  photo_url?: string;
  current_class?: string;
  current_section?: string;
  emergency_contact_phone?: string;
  father_name?: string;
  grandfather_name?: string;
}

interface StudentIDCardProps {
  student: Student;
  academicYear?: string;
}

export const StudentIDCard = ({ 
  student, 
  academicYear = new Date().getFullYear().toString()
}: StudentIDCardProps) => {
  const [frontImageLoaded, setFrontImageLoaded] = useState(false);
  const [backImageLoaded, setBackImageLoaded] = useState(false);

  const formatGradeLevel = (grade: string) => {
    return grade.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatFullName = (student: Student) => {
    const parts = [];
    
    // Debug logging
    console.log('Student data for name formatting:', {
      first_name: student.first_name,
      last_name: student.last_name,
      father_name: student.father_name,
      grandfather_name: student.grandfather_name
    });
    
    // Add first name
    if (student.first_name && student.first_name.trim()) {
      parts.push(student.first_name.trim());
    }
    
    // Check if last_name contains father's and grandfather's names
    // If it does, use only last_name; otherwise use the separate fields
    const lastName = student.last_name?.trim() || '';
    const fatherName = student.father_name?.trim() || '';
    const grandfatherName = student.grandfather_name?.trim() || '';
    
    // If last_name contains both father and grandfather names, just use it
    if (lastName && fatherName && grandfatherName && 
        lastName.includes(fatherName) && lastName.includes(grandfatherName)) {
      parts.push(lastName);
    } else {
      // Otherwise, build the name from individual components
      if (lastName) {
        parts.push(lastName);
      }
      
      // Only add father's name if it's not already in the last name
      if (fatherName && !lastName.includes(fatherName)) {
        parts.push(fatherName);
      }
      
      // Only add grandfather's name if it's not already in the last name and different from father's name
      if (grandfatherName && 
          !lastName.includes(grandfatherName) && 
          grandfatherName !== fatherName) {
        parts.push(grandfatherName);
      }
    }
    
    const fullName = parts.join(' ');
    console.log('Formatted full name:', fullName);
    return fullName;
  };

  const LoadingAnimation = () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
    </div>
  );

  return (
    <div className="w-[400px] h-[600px] relative">
      {/* Front Side */}
      <Card className="w-full h-[250px] relative overflow-hidden mb-4">
        <CardContent className="p-0 h-full relative">
          {/* SVG Background with Loading */}
          <div className="absolute inset-0">
            {!frontImageLoaded && <LoadingAnimation />}
            <img 
              src="/Green%20Blue%20Modern%20Student%20ID%20Card.svg" 
              alt="Student ID Card Front Design"
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                frontImageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => {
                console.log('Front SVG loaded successfully');
                setFrontImageLoaded(true);
              }}
              onError={(e) => {
                console.error('Front SVG failed to load, trying alternative path');
                // Try alternative path without spaces
                const target = e.currentTarget;
                if (target.src.includes('%20')) {
                  target.src = '/green-blue-modern-student-id-card.svg';
                } else {
                  console.error('All SVG paths failed, using fallback gradient');
                  setFrontImageLoaded(true);
                  // Blue gradient fallback
                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjI1MCIgdmlld0JveD0iMCAwIDQwMCAyNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJhIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzI1NWM5NCIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzFhYmRiYiIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMjUwIiBmaWxsPSJ1cmwoI2EpIi8+PC9zdmc+';
                }
              }}
            />
          </div>

          {/* Student Photo - Moved upward and slightly left */}
          <div className="absolute top-[65px] right-[35px] z-20">
            <div className="w-[130px] h-[130px] rounded-full overflow-hidden bg-white border-2 border-white shadow-lg">
              {student.photo_url ? (
                <img 
                  src={student.photo_url} 
                  alt={`${student.first_name} ${student.last_name}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500 text-xs font-medium">Photo</span>
                </div>
              )}
            </div>
          </div>

          {/* Student Information - Fixed name formatting */}
          <div className="absolute top-[145px] left-[140px] z-20 space-y-2 max-w-[140px]">
            {/* Student ID */}
            <div className="text-white font-semibold text-[8px] leading-tight">
              {student.student_id}
            </div>
            
            {/* Full Name - Properly formatted without repetition */}
            <div className="text-white font-semibold text-[8px] leading-tight">
              {formatFullName(student)}
            </div>
            
            {/* Grade Level */}
            <div className="text-white font-semibold text-[8px] leading-tight">
              {formatGradeLevel(student.grade_level)}
            </div>
            
            {/* Emergency Contact */}
            <div className="text-white font-semibold text-[8px] leading-tight">
              {student.emergency_contact_phone || 'N/A'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Back Side - Clean design without text */}
      <Card className="w-full h-[250px] relative overflow-hidden">
        <CardContent className="p-0 h-full relative">
          <div className="absolute inset-0 bg-white">
            {!backImageLoaded && <LoadingAnimation />}
            <img 
              src="/2.svg" 
              alt="Student ID Card Back Design"
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                backImageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => {
                console.log('Back SVG loaded successfully');
                setBackImageLoaded(true);
              }}
              onError={(e) => {
                console.error('Back SVG failed to load, hiding element');
                setBackImageLoaded(true);
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
