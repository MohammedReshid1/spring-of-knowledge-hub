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
    
    // Add first name and last name
    if (student.first_name) {
      parts.push(student.first_name.trim());
    }
    if (student.last_name) {
      parts.push(student.last_name.trim());
    }
    
    // Add father's name if it exists and is not empty
    if (student.father_name && student.father_name.trim()) {
      parts.push(student.father_name.trim());
    }
    
    // Add grandfather's name only if it exists, is not empty, AND is different from father's name
    if (student.grandfather_name && 
        student.grandfather_name.trim() && 
        student.grandfather_name.trim() !== student.father_name?.trim()) {
      parts.push(student.grandfather_name.trim());
    }
    
    return parts.join(' ');
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
              src="/Green Blue Modern Student ID Card.svg" 
              alt="Student ID Card Front Design"
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                frontImageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setFrontImageLoaded(true)}
              onError={(e) => {
                console.log('Front SVG failed to load');
                setFrontImageLoaded(true);
                e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjI1MCIgdmlld0JveD0iMCAwIDQwMCAyNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMjUwIiBmaWxsPSIjMzB3NCIvPgo8L3N2Zz4K';
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
              onLoad={() => setBackImageLoaded(true)}
              onError={(e) => {
                console.log('Back SVG failed to load');
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
