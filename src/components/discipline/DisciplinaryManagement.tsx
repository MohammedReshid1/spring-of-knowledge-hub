import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IncidentManagement } from './IncidentManagement';
import { BehaviorPoints } from './BehaviorPoints';
import { RewardManagement } from './RewardManagement';
import { CounselingManagement } from './CounselingManagement';
import { BehaviorContracts } from './BehaviorContracts';
import { DisciplinaryStats } from './DisciplinaryStats';
import { useBranch } from '@/contexts/BranchContext';
import { 
  AlertTriangle, 
  Award, 
  Users, 
  FileText,
  Heart,
  Target,
  TrendingUp,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';

interface DisciplinaryStatsData {
  total_incidents: number;
  open_incidents: number;
  resolved_incidents: number;
  incidents_by_type: Record<string, number>;
  incidents_by_severity: Record<string, number>;
  positive_behavior_points: number;
  negative_behavior_points: number;
  rewards_given: number;
  counseling_sessions_held: number;
  behavior_contracts_active: number;
  parent_meetings_scheduled: number;
  disciplinary_actions_pending: number;
}

export const DisciplinaryManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  
  // Branch-aware quick stats for header
  const { selectedBranch, isHQRole } = useBranch();
  const { data: stats } = useQuery<DisciplinaryStatsData>({
    queryKey: ['disciplinary-stats', selectedBranch],
    queryFn: async () => {
      const response = await apiClient.getDisciplinaryStats(
        isHQRole && selectedBranch && selectedBranch !== 'all' ? selectedBranch : undefined
      );
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data;
    },
    enabled: !isHQRole || !!selectedBranch,
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Disciplinary Management</h1>
          <p className="text-muted-foreground">
            Manage student behavior, incidents, rewards, and counseling
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Incidents</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.open_incidents}</div>
              <p className="text-xs text-muted-foreground">
                of {stats.total_incidents} total incidents
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Positive Points</CardTitle>
              <Award className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.positive_behavior_points}</div>
              <p className="text-xs text-muted-foreground">
                behavior points awarded
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rewards Given</CardTitle>
              <Award className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.rewards_given}</div>
              <p className="text-xs text-muted-foreground">
                student achievements
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Counseling Sessions</CardTitle>
              <Heart className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.counseling_sessions_held}</div>
              <p className="text-xs text-muted-foreground">
                support sessions completed
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alert Cards */}
      {stats && (stats.disciplinary_actions_pending > 0 || stats.open_incidents > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {stats.open_incidents > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-orange-800 flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  Open Incidents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-orange-700">
                  {stats.open_incidents} incident(s) require attention and resolution
                </p>
              </CardContent>
            </Card>
          )}

          {stats.disciplinary_actions_pending > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-red-800 flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Pending Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-red-700">
                  {stats.disciplinary_actions_pending} disciplinary action(s) pending implementation
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Behavior Summary Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-green-800 flex items-center">
                <CheckCircle className="h-5 w-5 mr-2" />
                Positive Behavior
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.positive_behavior_points}
              </div>
              <p className="text-sm text-green-700">
                Points awarded for good behavior
              </p>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-red-800 flex items-center">
                <XCircle className="h-5 w-5 mr-2" />
                Negative Points
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.negative_behavior_points}
              </div>
              <p className="text-sm text-red-700">
                Points deducted for violations
              </p>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-blue-800 flex items-center">
                <Target className="h-5 w-5 mr-2" />
                Active Contracts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.behavior_contracts_active}
              </div>
              <p className="text-sm text-blue-700">
                Behavior improvement plans
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="behavior">Behavior</TabsTrigger>
          <TabsTrigger value="rewards">Rewards</TabsTrigger>
          <TabsTrigger value="counseling">Counseling</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <DisciplinaryStats />
        </TabsContent>

        <TabsContent value="incidents">
          <IncidentManagement />
        </TabsContent>

        <TabsContent value="behavior">
          <BehaviorPoints />
        </TabsContent>

        <TabsContent value="rewards">
          <RewardManagement />
        </TabsContent>

        <TabsContent value="counseling">
          <CounselingManagement />
        </TabsContent>

        <TabsContent value="contracts">
          <BehaviorContracts />
        </TabsContent>
      </Tabs>
    </div>
  );
};
