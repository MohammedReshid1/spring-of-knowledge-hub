
import { Card, CardContent } from '@/components/ui/card';

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
}

interface StudentIDCardProps {
  student: Student;
  schoolName?: string;
  academicYear?: string;
}

export const StudentIDCard = ({ 
  student, 
  schoolName = "Spring of Knowledge Academy",
  academicYear = new Date().getFullYear().toString()
}: StudentIDCardProps) => {
  const formatGradeLevel = (grade: string) => {
    return grade.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Card className="w-[400px] h-[250px] relative overflow-hidden">
      <CardContent className="p-0 h-full relative">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-teal-400 to-blue-600"></div>
        
        {/* Wave Pattern Overlay */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.3'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        ></div>

        {/* School Logo */}
        <div className="absolute top-4 left-4 text-white">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-2">
            <div className="w-12 h-12 bg-white/30 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-white">S</span>
            </div>
          </div>
        </div>

        {/* Student ID Card Title */}
        <div className="absolute top-4 left-24 text-white">
          <h1 className="text-2xl font-bold tracking-wide">STUDENT ID CARD</h1>
        </div>

        {/* Student Photo */}
        <div className="absolute top-20 right-8">
          <div className="w-24 h-24 rounded-full border-4 border-white overflow-hidden bg-white">
            {student.photo_url ? (
              <img 
                src={student.photo_url} 
                alt={`${student.first_name} ${student.last_name}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-500 text-xs">No Photo</span>
              </div>
            )}
          </div>
        </div>

        {/* Student Information */}
        <div className="absolute bottom-0 left-0 right-0 bg-teal-500 text-white p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="mb-2">
                <span className="font-medium">ID Number</span>
                <span className="block text-lg font-bold">: {student.student_id}</span>
              </div>
              <div className="mb-2">
                <span className="font-medium">Full Name</span>
                <span className="block text-lg font-bold">: {student.first_name} {student.last_name}</span>
              </div>
            </div>
            <div>
              <div className="mb-2">
                <span className="font-medium">Grade Level</span>
                <span className="block text-lg font-bold">: {formatGradeLevel(student.grade_level)}</span>
              </div>
              <div className="mb-2">
                <span className="font-medium">Emergency Contact</span>
                <span className="block text-lg font-bold">: {student.emergency_contact_phone || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Back side info */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-teal-600 flex items-center justify-center">
          <div className="text-center text-white text-xs space-y-1">
            <div className="font-bold text-lg">{schoolName.toUpperCase()}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
