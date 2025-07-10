import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { debounce } from 'lodash';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Edit, Trash2, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { getHighlightedText } from '@/utils/searchHighlight';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { StudentIdGenerator } from '@/utils/studentIdGenerator';

interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  mother_name: string;
  father_name: string;
  grandfather_name: string;
  date_of_birth: string;
  gender: string;
  grade_level: string;
  class_id: string;
  phone: string;
  phone_secondary: string;
  email: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  medical_info: string;
  previous_school: string;
  admission_date: string;
  photo_url: string;
  birth_certificate_url: string;
  status: string;
  created_at: string;
}

export const StudentList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Active');
  const queryClient = useQueryClient();

  // Debounced search function
  const debouncedSearch = debounce((term: string) => {
    setDebouncedSearchTerm(term);
  }, 300);

  const { data: students, isLoading, error } = useQuery({
    queryKey: ['students', debouncedSearchTerm, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false });

      if (debouncedSearchTerm) {
        query = query.or(`student_id.ilike.%${debouncedSearchTerm}%,first_name.ilike.%${debouncedSearchTerm}%,last_name.ilike.%${debouncedSearchTerm}%,mother_name.ilike.%${debouncedSearchTerm}%,father_name.ilike.%${debouncedSearchTerm}%,phone.ilike.%${debouncedSearchTerm}%,email.ilike.%${debouncedSearchTerm}%`);
      }

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const handleDelete = async (student: any) => {
    if (!window.confirm('Are you sure you want to delete this student?')) {
      return;
    }

    try {
      // Mark the student ID for potential reuse
      await StudentIdGenerator.markIdForReuse(student.student_id);

      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', student.id);

      if (error) throw error;

      toast({
        title: "Student deleted",
        description: `${student.first_name} ${student.last_name} has been deleted successfully. Student ID ${student.student_id} is now available for reuse.`,
      });

      // Refetch students
      queryClient.invalidateQueries({ queryKey: ['students'] });
    } catch (error) {
      console.error('Error deleting student:', error);
      toast({
        title: "Error",
        description: "Failed to delete student. Please try again.",
        variant: "destructive"
      });
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        Error: {error.message}
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>
          Student List
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                debouncedSearch(e.target.value);
              }}
            />
            <div>
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                className="w-full p-2 border rounded"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Transferred Out">Transferred Out</option>
                <option value="Dropped Out">Dropped Out</option>
              </select>
            </div>
            <Link to="/students/new">
              <Button>Add New Student</Button>
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Student ID</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students?.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={student.photo_url} alt={`${student.first_name} ${student.last_name}`} />
                        <AvatarFallback className="bg-primary/10 text-primary font-medium">{getInitials(student.first_name, student.last_name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-bold">{getHighlightedText(`${student.first_name} ${student.last_name}`, searchTerm)}</div>
                        <div className="text-sm text-gray-500">{student.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{getHighlightedText(student.student_id, searchTerm)}</TableCell>
                  <TableCell>{student.grade_level}</TableCell>
                  <TableCell>{student.status}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link to={`/students/${student.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                      </Link>
                      <Link to={`/students/edit/${student.id}`}>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </Link>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle>Are you absolutely sure?</DialogTitle>
                            <DialogDescription>
                              This action cannot be undone. This will permanently delete this student from our servers.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                          Are you sure you want to delete {student.first_name} {student.last_name}?
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button type="button" variant="secondary" onClick={() => {
                            const dialog = document.querySelector('[data-state="open"]');
                            if (dialog) {
                              (dialog as HTMLDialogElement).close();
                            }
                          }}>Cancel</Button>
                            <Button type="submit" onClick={() => handleDelete(student)} variant="destructive">Delete</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
