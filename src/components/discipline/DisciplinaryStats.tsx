import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AlertTriangle, 
  Award, 
  TrendingUp, 
  BarChart3,
  CheckCircle,
  XCircle,
  Clock,
  Users
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

import { useBranch } from '@/contexts/BranchContext';

export const DisciplinaryStats: React.FC = () => {
  const { selectedBranch, isHQRole } = useBranch();
  const { data: stats, isLoading } = useQuery<DisciplinaryStatsData>({
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

  if (isLoading) {
    return <div className="text-center py-8">Loading statistics...</div>;
  }

  if (!stats) {
    return <div className="text-center py-8">No statistics available</div>;
  }

  const getIncidentTypeLabel = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getSeverityColor = (severity: string) => {
    const colors = {
      minor: 'text-green-600',
      moderate: 'text-yellow-600',
      major: 'text-orange-600',
      severe: 'text-red-600'
    };
    return colors[severity as keyof typeof colors] || 'text-gray-600';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Disciplinary Statistics</h2>
        <p className="text-muted-foreground">Overview of student behavior and disciplinary actions</p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_incidents}</div>
            <p className="text-xs text-muted-foreground">
              {stats.resolved_incidents} resolved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Behavior Balance</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              +{stats.positive_behavior_points - stats.negative_behavior_points}
            </div>
            <p className="text-xs text-muted-foreground">
              Net positive behavior points
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
              Student achievements
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Support Sessions</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.counseling_sessions_held}</div>
            <p className="text-xs text-muted-foreground">
              Counseling sessions completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Behavior Points Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
              Positive Behavior
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 mb-2">
              {stats.positive_behavior_points}
            </div>
            <p className="text-sm text-muted-foreground">
              Points awarded for good behavior and achievements
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Recognition Rate</span>
                <span className="font-bold text-green-600">
                  {((stats.positive_behavior_points / (stats.positive_behavior_points + stats.negative_behavior_points)) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <XCircle className="h-5 w-5 mr-2 text-red-600" />
              Behavioral Concerns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600 mb-2">
              {stats.negative_behavior_points}
            </div>
            <p className="text-sm text-muted-foreground">
              Points deducted for rule violations and misconduct
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Open Incidents</span>
                <span className="font-bold text-orange-600">{stats.open_incidents}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Incident Analysis */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Incidents by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(stats.incidents_by_type).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(stats.incidents_by_type).map(([type, count]) => (
                  <div key={type} className="flex justify-between items-center">
                    <span className="text-sm">{getIncidentTypeLabel(type)}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${(count / stats.total_incidents) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-bold">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No incident data available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Severity Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(stats.incidents_by_severity).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(stats.incidents_by_severity).map(([severity, count]) => (
                  <div key={severity} className="flex justify-between items-center">
                    <span className="text-sm capitalize">{severity}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${getSeverityColor(severity).replace('text-', 'bg-')}`}
                          style={{ width: `${(count / stats.total_incidents) * 100}%` }}
                        ></div>
                      </div>
                      <span className={`text-sm font-bold ${getSeverityColor(severity)}`}>{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No severity data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Items */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="text-orange-800 flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Pending Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats.disciplinary_actions_pending}
            </div>
            <p className="text-sm text-orange-700">
              Disciplinary actions awaiting implementation
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-800 flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Active Interventions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.behavior_contracts_active}
            </div>
            <p className="text-sm text-blue-700">
              Behavior improvement contracts in progress
            </p>
          </CardContent>
        </Card>

        <Card className="border-purple-200">
          <CardHeader>
            <CardTitle className="text-purple-800 flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Parent Engagement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {stats.parent_meetings_scheduled}
            </div>
            <p className="text-sm text-purple-700">
              Parent meetings scheduled
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle>Disciplinary System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="font-medium text-green-800">Positive Environment</span>
              </div>
              <p className="text-sm text-green-700">
                {stats.positive_behavior_points > stats.negative_behavior_points 
                  ? 'More positive behavior than negative incidents recorded'
                  : 'Focus needed on positive behavior reinforcement'}
              </p>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="font-medium text-blue-800">Resolution Rate</span>
              </div>
              <p className="text-sm text-blue-700">
                {((stats.resolved_incidents / stats.total_incidents) * 100).toFixed(1)}% of incidents have been resolved
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
