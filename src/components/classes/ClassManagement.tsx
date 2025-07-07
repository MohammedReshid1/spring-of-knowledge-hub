import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Eye, BookOpenCheck } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { ClassFormDialog } from './ClassFormDialog';
import { ClassDetailsDialog } from './ClassDetailsDialog';

export const ClassManagement = () => {
  const [showForm, setShowForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [classToDelete, setClassToDelete] = useState(null);
  const { toast } = useToast();

  const { data: classes, isLoading, refetch } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select(`
          *,
          grade_levels:grade_level_id (
            grade
          ),
          teacher:teacher_id (
            full_name
          )
        `)
        .order('class_name');
      
      if (error) throw error;
      return data;
    }
  });

  const { data: students } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*');
      
      if (error) throw error;
      return data;
    }
  });

  const { data: teachers } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'teacher');
      
      if (error) throw error;
      return data;
    }
  });

  const { data: gradeLevels } = useQuery({
    queryKey: ['grade-levels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grade_levels')
        .select('*')
        .order('grade');
      
      if (error) throw error;
      return data;
    }
  });

  const filteredClasses = classes?.filter(cls => {
    const searchLower = searchTerm.toLowerCase();
    
    return !searchTerm || 
      cls.class_name.toLowerCase().includes(searchLower) ||
      (cls.grade_levels?.grade && cls.grade_levels.grade.toLowerCase().includes(searchLower)) ||
      (cls.teacher?.full_name && cls.teacher.full_name.toLowerCase().includes(searchLower));
  }) || [];

  const classStudents = students?.filter(student => student.class_id === selectedClass?.id) || [];

  const handleOpenForm = () => {
    setSelectedClass(null);
    setIsEditMode(false);
    setShowForm(true);
  };

  const handleEditClass = (classItem: any) => {
    setSelectedClass(classItem);
    setIsEditMode(true);
    setShowForm(true);
  };

  const handleDeleteClass = async () => {
    if (!classToDelete) return;

    const { error } = await supabase
      .from('classes')
      .delete()
      .eq('id', classToDelete.id);

    if (error) {
      toast({
        title: "Error deleting class",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Class deleted",
        description: `Class ${classToDelete.class_name} has been successfully deleted.`,
      });
      refetch(); // Refresh classes
    }

    setShowDeleteDialog(false);
    setClassToDelete(null);
  };

  const handleViewClass = (classItem: any) => {
    setSelectedClass(classItem);
    setShowDetails(true);
  };

  const formatGradeLevel = (grade: string) => {
    return grade.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header and Action Buttons */}
      <div className="flex justify-between items-center">
        <CardHeader className="pl-0">
          <CardTitle className="text-2xl">Manage Classes</CardTitle>
        </CardHeader>
        <Button onClick={handleOpenForm} className="space-x-2">
          <Plus className="h-4 w-4" />
          <span>Add Class</span>
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="search">Search Classes</Label>
              <Input
                type="text"
                id="search"
                placeholder="Search by name, grade, or teacher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="grade-filter">Filter by Grade</Label>
              <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                <SelectTrigger>
                  <SelectValue placeholder="All Grades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  {gradeLevels?.map((grade) => (
                    <SelectItem key={grade.id} value={grade.id}>
                      {formatGradeLevel(grade.grade)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Classes Table */}
      <Card>
        <CardHeader>
          <CardTitle>Classes</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredClasses.length === 0 ? (
            <div className="text-center py-12">
              <BookOpenCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No classes found</p>
              <p className="text-gray-500 text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClasses.map((cls) => (
                    <TableRow key={cls.id}>
                      <TableCell>{cls.class_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {cls.grade_levels?.grade ? formatGradeLevel(cls.grade_levels.grade) : 'Not assigned'}
                        </Badge>
                      </TableCell>
                      <TableCell>{cls.teacher?.full_name || 'Not assigned'}</TableCell>
                      <TableCell>{cls.current_enrollment} / {cls.max_capacity}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewClass(cls)}
                            className="hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditClass(cls)}
                            className="hover:bg-gray-50"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setClassToDelete(cls);
                              setShowDeleteDialog(true);
                            }}
                            className="hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Class Form Modal */}
      <ClassFormDialog
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        isEditMode={isEditMode}
        selectedClass={selectedClass}
        teachers={teachers}
        gradeLevels={gradeLevels}
        refetchClasses={refetch}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDeleteDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteClass}
        itemType="class"
        itemName={classToDelete?.class_name}
      />

      {/* Class Details Dialog */}
      {selectedClass && (
        <ClassDetailsDialog
          classData={selectedClass}
          students={classStudents}
          isOpen={showDetails}
          onClose={() => {
            setShowDetails(false);
            setSelectedClass(null);
          }}
        />
      )}
    </div>
  );
};
