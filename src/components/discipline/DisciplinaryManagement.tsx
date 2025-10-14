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
    <>
      {/* Premium Animation Styles */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes pulseGlow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
          }
          50% {
            box-shadow: 0 0 30px rgba(59, 130, 246, 0.5);
          }
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out;
        }

        .animate-slideInRight {
          animation: slideInRight 0.6s ease-out;
        }

        .animate-pulseGlow {
          animation: pulseGlow 2s infinite;
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Premium Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 pb-20 pt-16">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/90 via-blue-700/90 to-indigo-800/90" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        {/* Enhanced Floating Shapes with Animation */}
        <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full animate-pulse" />
        <div className="absolute top-20 right-20 w-16 h-16 bg-white/10 rounded-full animate-pulse delay-1000" />
        <div className="absolute bottom-20 left-1/3 w-12 h-12 bg-white/10 rounded-full animate-pulse delay-500" />
        <div className="absolute top-1/2 left-20 w-8 h-8 bg-white/8 rounded-full animate-pulse delay-300" />
        <div className="absolute top-1/3 right-1/4 w-14 h-14 bg-white/8 rounded-full animate-pulse delay-700" />
        <div className="absolute bottom-1/3 right-10 w-10 h-10 bg-white/8 rounded-full animate-pulse delay-900" />
        <div className="absolute top-1/4 left-1/2 w-6 h-6 bg-white/6 rounded-full animate-pulse delay-400" />
        <div className="absolute bottom-10 left-1/4 w-18 h-18 bg-white/8 rounded-full animate-pulse delay-800" />

        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-8 inline-flex items-center rounded-full bg-white/10 backdrop-blur-sm px-6 py-2 text-sm font-medium text-white/90 ring-1 ring-white/20">
              <AlertTriangle className="mr-2 h-4 w-4" />
              Disciplinary Management System
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
              Disciplinary <span className="bg-gradient-to-r from-blue-200 to-cyan-200 bg-clip-text text-transparent">Management</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-blue-100">
              Comprehensive behavioral management with incident tracking, positive reinforcement, and counseling support.
              Streamline your disciplinary processes with premium tools.
            </p>
          </div>
        </div>

        {/* Wave Bottom */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg className="w-full h-20 fill-current text-slate-50" viewBox="0 0 1440 120">
            <path d="M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z" />
          </svg>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 -mt-10 space-y-8 px-6 pb-16">
        {/* Action Bar */}
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
              <p className="text-sm text-gray-600">Manage disciplinary records efficiently with powerful tools</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Action buttons will be added here if needed */}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mx-auto max-w-7xl">
          {stats && (
            <div className="relative">
              {/* Background card with glass morphism */}
              <div className="absolute inset-0 bg-white/80 backdrop-blur-glass border border-white/30 rounded-3xl shadow-premium"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/8 via-red-500/8 to-rose-500/8 rounded-3xl pointer-events-none"></div>

              <Card className="relative bg-transparent border-0 shadow-none">
                <CardHeader className="p-8">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-orange-100 to-red-100 border border-orange-200/50">
                      <TrendingUp className="h-5 w-5 text-orange-600" />
                    </div>
                    <CardTitle className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-orange-800 to-red-900 bg-clip-text text-transparent">
                      Behavioral Management Overview
                    </CardTitle>
                  </div>
                  <p className="text-slate-600 leading-relaxed">Real-time insights into student behavior patterns and intervention effectiveness</p>
                </CardHeader>
                <CardContent className="px-8 pb-8">
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <div className="group relative animate-fade-in-up">
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-premium group-hover:shadow-glow-subtle transition-all duration-normal"></div>
                      <div className="absolute inset-0 bg-gradient-to-br from-orange-50/80 to-red-50/80 border border-orange-200/50 rounded-2xl"></div>
                      <div className="relative p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-slate-900 text-lg">Open Incidents</h3>
                          <div className="p-2 rounded-xl bg-orange-100 border border-orange-200">
                            <AlertTriangle className="h-5 w-5 text-orange-600" />
                          </div>
                        </div>
                        <div className="text-3xl font-bold text-orange-600">{stats.open_incidents}</div>
                        <p className="text-sm text-slate-600 font-medium">
                          of {stats.total_incidents} total incidents
                        </p>
                      </div>
                    </div>

                    <div className="group relative animate-fade-in-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-premium group-hover:shadow-glow-subtle transition-all duration-normal"></div>
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/80 to-green-50/80 border border-emerald-200/50 rounded-2xl"></div>
                      <div className="relative p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-slate-900 text-lg">Positive Points</h3>
                          <div className="p-2 rounded-xl bg-emerald-100 border border-emerald-200">
                            <Award className="h-5 w-5 text-emerald-600" />
                          </div>
                        </div>
                        <div className="text-3xl font-bold text-emerald-600">{stats.positive_behavior_points}</div>
                        <p className="text-sm text-slate-600 font-medium">
                          behavior points awarded
                        </p>
                      </div>
                    </div>

                    <div className="group relative animate-fade-in-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-premium group-hover:shadow-glow-subtle transition-all duration-normal"></div>
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-50/80 to-violet-50/80 border border-purple-200/50 rounded-2xl"></div>
                      <div className="relative p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-slate-900 text-lg">Rewards Given</h3>
                          <div className="p-2 rounded-xl bg-purple-100 border border-purple-200">
                            <Award className="h-5 w-5 text-purple-600" />
                          </div>
                        </div>
                        <div className="text-3xl font-bold text-purple-600">{stats.rewards_given}</div>
                        <p className="text-sm text-slate-600 font-medium">
                          student achievements
                        </p>
                      </div>
                    </div>

                    <div className="group relative animate-fade-in-up" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-premium group-hover:shadow-glow-subtle transition-all duration-normal"></div>
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/80 to-cyan-50/80 border border-blue-200/50 rounded-2xl"></div>
                      <div className="relative p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-slate-900 text-lg">Counseling Sessions</h3>
                          <div className="p-2 rounded-xl bg-blue-100 border border-blue-200">
                            <Heart className="h-5 w-5 text-blue-600" />
                          </div>
                        </div>
                        <div className="text-3xl font-bold text-blue-600">{stats.counseling_sessions_held}</div>
                        <p className="text-sm text-slate-600 font-medium">
                          support sessions completed
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Alert Cards */}
        <div className="mx-auto max-w-7xl">
          {stats && (stats.disciplinary_actions_pending > 0 || stats.open_incidents > 0) && (
            <div className="grid gap-6 md:grid-cols-2">
              {stats.open_incidents > 0 && (
                <div className="relative">
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-glass border border-orange-200/50 rounded-2xl shadow-premium"></div>
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-50/80 to-red-50/80 rounded-2xl"></div>
                  <Card className="relative bg-transparent border-0 shadow-none">
                    <CardHeader className="p-6 pb-3">
                      <CardTitle className="text-orange-800 flex items-center text-lg font-bold">
                        <div className="p-2 rounded-xl bg-orange-100 border border-orange-200 mr-3">
                          <AlertTriangle className="h-5 w-5 text-orange-600" />
                        </div>
                        Open Incidents
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-6 pb-6">
                      <p className="text-orange-700 font-medium">
                        {stats.open_incidents} incident(s) require attention and resolution
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {stats.disciplinary_actions_pending > 0 && (
                <div className="relative">
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-glass border border-red-200/50 rounded-2xl shadow-premium"></div>
                  <div className="absolute inset-0 bg-gradient-to-br from-red-50/80 to-rose-50/80 rounded-2xl"></div>
                  <Card className="relative bg-transparent border-0 shadow-none">
                    <CardHeader className="p-6 pb-3">
                      <CardTitle className="text-red-800 flex items-center text-lg font-bold">
                        <div className="p-2 rounded-xl bg-red-100 border border-red-200 mr-3">
                          <Clock className="h-5 w-5 text-red-600" />
                        </div>
                        Pending Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-6 pb-6">
                      <p className="text-red-700 font-medium">
                        {stats.disciplinary_actions_pending} disciplinary action(s) pending implementation
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="mx-auto max-w-7xl">
          <div className="relative">
            {/* Background card with glass morphism */}
            <div className="absolute inset-0 bg-white/80 backdrop-blur-glass border border-white/30 rounded-3xl shadow-premium"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/8 via-orange-500/8 to-yellow-500/8 rounded-3xl pointer-events-none"></div>

            <Card className="relative bg-transparent border-0 shadow-none">
              <CardHeader className="p-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-red-100 to-orange-100 border border-red-200/50">
                    <FileText className="h-5 w-5 text-red-600" />
                  </div>
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-red-800 to-orange-900 bg-clip-text text-transparent">
                    Management Tools
                  </CardTitle>
                </div>
                <p className="text-slate-600 leading-relaxed">Comprehensive tools for managing student behavior and disciplinary processes</p>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                  <TabsList className="grid w-full grid-cols-6 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl p-2 h-auto">
                    <TabsTrigger
                      value="overview"
                      className="data-[state=active]:bg-red-500 data-[state=active]:text-white data-[state=active]:shadow-premium rounded-xl py-3 px-4 font-semibold transition-all duration-normal hover:bg-white/80"
                    >
                      Overview
                    </TabsTrigger>
                    <TabsTrigger
                      value="incidents"
                      className="data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-premium rounded-xl py-3 px-4 font-semibold transition-all duration-normal hover:bg-white/80"
                    >
                      Incidents
                    </TabsTrigger>
                    <TabsTrigger
                      value="behavior"
                      className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-premium rounded-xl py-3 px-4 font-semibold transition-all duration-normal hover:bg-white/80"
                    >
                      Behavior
                    </TabsTrigger>
                    <TabsTrigger
                      value="rewards"
                      className="data-[state=active]:bg-purple-500 data-[state=active]:text-white data-[state=active]:shadow-premium rounded-xl py-3 px-4 font-semibold transition-all duration-normal hover:bg-white/80"
                    >
                      Rewards
                    </TabsTrigger>
                    <TabsTrigger
                      value="counseling"
                      className="data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-premium rounded-xl py-3 px-4 font-semibold transition-all duration-normal hover:bg-white/80"
                    >
                      Counseling
                    </TabsTrigger>
                    <TabsTrigger
                      value="contracts"
                      className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-premium rounded-xl py-3 px-4 font-semibold transition-all duration-normal hover:bg-white/80"
                    >
                      Contracts
                    </TabsTrigger>
                  </TabsList>

                  <div className="bg-white/40 backdrop-blur-sm rounded-2xl border border-white/30 p-8">
                    <TabsContent value="overview" className="mt-0">
                      <DisciplinaryStats />
                    </TabsContent>

                    <TabsContent value="incidents" className="mt-0">
                      <IncidentManagement />
                    </TabsContent>

                    <TabsContent value="behavior" className="mt-0">
                      <BehaviorPoints />
                    </TabsContent>

                    <TabsContent value="rewards" className="mt-0">
                      <RewardManagement />
                    </TabsContent>

                    <TabsContent value="counseling" className="mt-0">
                      <CounselingManagement />
                    </TabsContent>

                    <TabsContent value="contracts" className="mt-0">
                      <BehaviorContracts />
                    </TabsContent>
                  </div>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};
