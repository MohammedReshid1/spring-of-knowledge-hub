import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TimetableAPI } from '@/services/timetableApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { usePermissionCheck } from '@/contexts/RoleAccessContext';
import { useBranch } from '@/contexts/BranchContext';
import {
  MapPin,
  Plus,
  Edit3,
  Trash2,
  Search,
  Filter,
  Building2,
  Users,
  Wifi,
  Monitor,
  BookOpen,
  FlaskConical,
  Dumbbell,
  Theater,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import type { Room, RoomCreate } from '@/types/timetable';

const ROOM_TYPES = [
  { value: 'classroom', label: 'Classroom', icon: BookOpen, color: 'bg-blue-100 text-blue-800' },
  { value: 'laboratory', label: 'Laboratory', icon: FlaskConical, color: 'bg-purple-100 text-purple-800' },
  { value: 'auditorium', label: 'Auditorium', icon: Theater, color: 'bg-red-100 text-red-800' },
  { value: 'gym', label: 'Gymnasium', icon: Dumbbell, color: 'bg-green-100 text-green-800' },
  { value: 'library', label: 'Library', icon: BookOpen, color: 'bg-yellow-100 text-yellow-800' }
];

const COMMON_EQUIPMENT = [
  'Projector',
  'Whiteboard',
  'Smart Board',
  'Computer',
  'Audio System',
  'Air Conditioning',
  'WiFi',
  'Science Equipment',
  'Sports Equipment',
  'Stage',
  'Microphone',
  'Video Camera'
];

export const RoomManagement: React.FC = () => {
  const { hasPermission } = usePermissionCheck();
  const queryClient = useQueryClient();
  const { selectedBranch } = useBranch();

  const canManage = hasPermission('timetable.manage');
  const canCreate = hasPermission('timetable.create') || canManage;
  const canUpdate = hasPermission('timetable.update') || canManage;
  const canDelete = hasPermission('timetable.delete') || canManage;

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterAvailable, setFilterAvailable] = useState<string>('all');

  // Form state
  const [formData, setFormData] = useState<Partial<RoomCreate>>({
    room_number: '',
    room_name: '',
    room_type: 'classroom',
    capacity: 30,
    equipment: [],
    is_available: true,
    floor: '',
    building: '',
    notes: ''
  });

  // Fetch rooms
  const { data: rooms = [], isLoading } = useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: () => TimetableAPI.getRooms({ limit: 100 })
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: RoomCreate) => TimetableAPI.createRoom(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setShowCreateDialog(false);
      resetForm();
      toast({
        title: 'Success',
        description: 'Room created successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to create room',
        variant: 'destructive'
      });
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Room) => TimetableAPI.updateRoom(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setShowCreateDialog(false);
      setEditingRoom(null);
      resetForm();
      toast({
        title: 'Success',
        description: 'Room updated successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to update room',
        variant: 'destructive'
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => TimetableAPI.deleteRoom(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast({
        title: 'Success',
        description: 'Room deleted successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Cannot delete room in use',
        variant: 'destructive'
      });
    }
  });

  const resetForm = () => {
    setFormData({
      room_number: '',
      room_name: '',
      room_type: 'classroom',
      capacity: 30,
      equipment: [],
      is_available: true,
      floor: '',
      building: '',
      notes: ''
    });
    setEditingRoom(null);
  };

  const handleEdit = (room: Room) => {
    setEditingRoom(room);
    setFormData({
      room_number: room.room_number,
      room_name: room.room_name,
      room_type: room.room_type,
      capacity: room.capacity,
      equipment: room.equipment,
      is_available: room.is_available,
      floor: room.floor,
      building: room.building,
      notes: room.notes
    });
    setShowCreateDialog(true);
  };

  const handleDelete = (id: string, roomNumber: string) => {
    if (confirm(`Are you sure you want to delete room ${roomNumber}? This will affect all timetable entries using it.`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleSubmit = () => {
    if (!formData.room_number || !formData.capacity) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in room number and capacity',
        variant: 'destructive'
      });
      return;
    }

    if (!selectedBranch) {
      toast({
        title: 'Validation Error',
        description: 'Please select a branch first',
        variant: 'destructive'
      });
      return;
    }

    const data: RoomCreate = {
      room_number: formData.room_number!,
      room_name: formData.room_name,
      room_type: formData.room_type || 'classroom',
      capacity: formData.capacity!,
      equipment: formData.equipment || [],
      is_available: formData.is_available !== false,
      floor: formData.floor,
      building: formData.building,
      notes: formData.notes,
      branch_id: selectedBranch
    };

    if (editingRoom) {
      updateMutation.mutate({ ...editingRoom, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const toggleEquipment = (equipment: string) => {
    const current = formData.equipment || [];
    if (current.includes(equipment)) {
      setFormData({ ...formData, equipment: current.filter(e => e !== equipment) });
    } else {
      setFormData({ ...formData, equipment: [...current, equipment] });
    }
  };

  const getRoomIcon = (type: string) => {
    const roomType = ROOM_TYPES.find(r => r.value === type);
    const Icon = roomType?.icon || MapPin;
    return <Icon className="h-5 w-5" />;
  };

  const getRoomColor = (type: string) => {
    return ROOM_TYPES.find(r => r.value === type)?.color || 'bg-gray-100 text-gray-800';
  };

  // Filter rooms
  const filteredRooms = rooms.filter(room => {
    const matchesSearch = room.room_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (room.room_name?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = filterType === 'all' || room.room_type === filterType;
    const matchesAvailable = filterAvailable === 'all' ||
                            (filterAvailable === 'available' && room.is_available) ||
                            (filterAvailable === 'unavailable' && !room.is_available);
    return matchesSearch && matchesType && matchesAvailable;
  });

  if (!canManage && !canCreate) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <p className="text-red-600">You don't have permission to manage rooms.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Room Management</h3>
          <p className="text-sm text-muted-foreground">
            Manage classrooms, labs, and facilities
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => {
            resetForm();
            setShowCreateDialog(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Room
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by room number or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <Label>Room Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {ROOM_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Availability</Label>
              <Select value={filterAvailable} onValueChange={setFilterAvailable}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rooms</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="unavailable">Unavailable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rooms Grid */}
      {isLoading ? (
        <Card>
          <CardContent className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading rooms...</p>
          </CardContent>
        </Card>
      ) : filteredRooms.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              {searchQuery || filterType !== 'all' || filterAvailable !== 'all'
                ? 'No rooms match your filters'
                : 'No rooms configured yet'}
            </p>
            {canCreate && !searchQuery && filterType === 'all' && (
              <Button onClick={() => {
                resetForm();
                setShowCreateDialog(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Room
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRooms.map((room) => (
            <Card key={room.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${getRoomColor(room.room_type)}`}>
                      {getRoomIcon(room.room_type)}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{room.room_number}</CardTitle>
                      {room.room_name && (
                        <p className="text-sm text-muted-foreground">{room.room_name}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant={room.is_available ? 'default' : 'secondary'}>
                    {room.is_available ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Available
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3 mr-1" />
                        Unavailable
                      </>
                    )}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Room Info */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{room.capacity} seats</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {ROOM_TYPES.find(t => t.value === room.room_type)?.label}
                    </Badge>
                  </div>
                </div>

                {(room.building || room.floor) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    <span>
                      {room.building && `Building ${room.building}`}
                      {room.building && room.floor && ', '}
                      {room.floor && `Floor ${room.floor}`}
                    </span>
                  </div>
                )}

                {/* Equipment */}
                {room.equipment.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Equipment:</p>
                    <div className="flex flex-wrap gap-1">
                      {room.equipment.slice(0, 3).map((eq, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {eq}
                        </Badge>
                      ))}
                      {room.equipment.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{room.equipment.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {room.notes && (
                  <p className="text-xs text-muted-foreground italic line-clamp-2">
                    {room.notes}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t">
                  {canUpdate && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(room)}
                      className="flex-1"
                    >
                      <Edit3 className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(room.id, room.room_number)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRoom ? 'Edit Room' : 'Create Room'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Room Number *</Label>
                <Input
                  placeholder="e.g., 101, Lab-A"
                  value={formData.room_number}
                  onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                />
              </div>
              <div>
                <Label>Room Name</Label>
                <Input
                  placeholder="e.g., Physics Lab"
                  value={formData.room_name}
                  onChange={(e) => setFormData({ ...formData, room_name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Room Type *</Label>
                <Select
                  value={formData.room_type}
                  onValueChange={(value) => setFormData({ ...formData, room_type: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROOM_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Capacity *</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Number of seats"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Building</Label>
                <Input
                  placeholder="e.g., A, Main, Science"
                  value={formData.building}
                  onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                />
              </div>
              <div>
                <Label>Floor</Label>
                <Input
                  placeholder="e.g., 1, Ground, 2nd"
                  value={formData.floor}
                  onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Equipment & Facilities</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {COMMON_EQUIPMENT.map((equipment) => (
                  <div
                    key={equipment}
                    className={`flex items-center gap-2 p-2 border rounded cursor-pointer transition-colors ${
                      formData.equipment?.includes(equipment)
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => toggleEquipment(equipment)}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                      formData.equipment?.includes(equipment)
                        ? 'bg-primary border-primary'
                        : 'border-muted-foreground'
                    }`}>
                      {formData.equipment?.includes(equipment) && (
                        <CheckCircle className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <span className="text-sm">{equipment}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional information about this room..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <Label className="mb-0">Room Available for Scheduling</Label>
              <Switch
                checked={formData.is_available}
                onCheckedChange={(checked) => setFormData({ ...formData, is_available: checked })}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSubmit} className="flex-1">
                {editingRoom ? 'Update Room' : 'Create Room'}
              </Button>
              <Button variant="outline" onClick={() => {
                setShowCreateDialog(false);
                resetForm();
              }}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RoomManagement;
