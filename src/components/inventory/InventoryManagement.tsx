import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  Wrench, 
  TrendingUp, 
  AlertTriangle,
  DollarSign,
  Settings,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  Monitor,
  Box
} from 'lucide-react';
import { AssetManagement } from './AssetManagement';
import { SupplyManagement } from './SupplyManagement';
import { MaintenanceManagement } from './MaintenanceManagement';
import { InventoryRequests } from './InventoryRequests';
import { InventoryAnalytics } from './InventoryAnalytics';
import { useBranch } from '@/contexts/BranchContext';

interface InventoryOverview {
  total_assets: number;
  active_assets: number;
  assets_under_maintenance: number;
  total_supplies: number;
  low_stock_supplies: number;
  pending_maintenance: number;
  overdue_maintenance: number;
  total_asset_value: number;
  category_distribution: Record<string, number>;
  system_health: {
    asset_utilization: number;
    maintenance_compliance: number;
    stock_adequacy: number;
  };
}

export const InventoryManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const { selectedBranch, isHQRole } = useBranch();

  const { data: overview, isLoading: overviewLoading } = useQuery<InventoryOverview>({
    queryKey: ['inventory-analytics-overview', selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      // Add branch filtering for HQ users
      if (isHQRole && selectedBranch && selectedBranch !== 'all') {
        params.append('branch_id', selectedBranch);
      }
      
      const response = await apiClient.get(`/inventory/analytics/overview?${params}`);
      return response.data as InventoryOverview;
    },
    enabled: !isHQRole || !!selectedBranch, // For HQ users, only fetch when a branch is selected
  });

  if (overviewLoading) {
    return <div className="text-center py-8">Loading inventory dashboard...</div>;
  }

  // Show branch selection message for HQ users who haven't selected a branch
  if (isHQRole && !selectedBranch) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Inventory Management</h1>
            <p className="text-muted-foreground">Comprehensive asset and supply management system</p>
          </div>
        </div>
        
        <Card>
          <CardContent className="text-center py-12">
            <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Select a Branch</h3>
            <p className="text-muted-foreground mb-4">
              Please select a branch using the branch selector in the top navigation to view inventory overview.
            </p>
            <p className="text-sm text-muted-foreground">
              As a superadmin, you can switch between branches to manage their respective inventories.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const StatCard = ({ title, value, icon: Icon, description, color = "blue", trend }: {
    title: string;
    value: string | number;
    icon: React.ElementType;
    description: string;
    color?: string;
    trend?: 'up' | 'down' | 'stable';
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 text-${color}-600`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{description}</p>
          {trend && (
            <div className={`flex items-center text-xs ${
              trend === 'up' ? 'text-green-600' : 
              trend === 'down' ? 'text-red-600' : 'text-gray-600'
            }`}>
              {trend === 'up' && <TrendingUp className="h-3 w-3 mr-1" />}
              {trend === 'down' && <TrendingUp className="h-3 w-3 mr-1 rotate-180" />}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getHealthColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthBadge = (percentage: number) => {
    if (percentage >= 90) return 'bg-green-100 text-green-800';
    if (percentage >= 70) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

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
          <div className="absolute inset-0 opacity-20"
               style={{
                 backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='10'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
               }} />

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
                <Package className="mr-2 h-4 w-4" />
                Inventory Management System
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
                Inventory <span className="bg-gradient-to-r from-blue-200 to-cyan-200 bg-clip-text text-transparent">Management</span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-blue-100">
                Comprehensive asset tracking, supply management, and maintenance scheduling with intelligent analytics.
                Optimize resource utilization with advanced inventory tools.
              </p>
            </div>
          </div>

          {/* Bottom Wave */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg className="w-full h-20 fill-current text-slate-50" viewBox="0 0 1440 120" preserveAspectRatio="none">
              <path d="M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z" />
            </svg>
          </div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 -mt-10 space-y-8 px-6 pb-16">

        {/* Navigation Tabs */}
        <div className="mx-auto max-w-7xl">
          <div className="relative">
            {/* Background card with glass morphism */}
            <div className="absolute inset-0 bg-white/80 backdrop-blur-glass border border-white/30 rounded-3xl shadow-premium"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/8 via-teal-500/8 to-cyan-500/8 rounded-3xl pointer-events-none"></div>

            <Card className="relative bg-transparent border-0 shadow-none">
              <CardHeader className="p-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 border border-emerald-200/50">
                    <Settings className="h-5 w-5 text-emerald-600" />
                  </div>
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-emerald-800 to-teal-900 bg-clip-text text-transparent">
                    Inventory Dashboard
                  </CardTitle>
                </div>
                <p className="text-slate-600 leading-relaxed">Comprehensive tools for managing assets, supplies, and maintenance operations</p>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                  <TabsList className="grid w-full grid-cols-6 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl p-2 h-auto">
                    <TabsTrigger
                      value="overview"
                      className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-premium rounded-xl py-3 px-4 font-semibold transition-all duration-normal hover:bg-white/80"
                    >
                      Overview
                    </TabsTrigger>
                    <TabsTrigger
                      value="assets"
                      className="data-[state=active]:bg-teal-500 data-[state=active]:text-white data-[state=active]:shadow-premium rounded-xl py-3 px-4 font-semibold transition-all duration-normal hover:bg-white/80"
                    >
                      Assets
                    </TabsTrigger>
                    <TabsTrigger
                      value="supplies"
                      className="data-[state=active]:bg-cyan-500 data-[state=active]:text-white data-[state=active]:shadow-premium rounded-xl py-3 px-4 font-semibold transition-all duration-normal hover:bg-white/80"
                    >
                      Supplies
                    </TabsTrigger>
                    <TabsTrigger
                      value="maintenance"
                      className="data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-premium rounded-xl py-3 px-4 font-semibold transition-all duration-normal hover:bg-white/80"
                    >
                      Maintenance
                    </TabsTrigger>
                    <TabsTrigger
                      value="requests"
                      className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-premium rounded-xl py-3 px-4 font-semibold transition-all duration-normal hover:bg-white/80"
                    >
                      Requests
                    </TabsTrigger>
                    <TabsTrigger
                      value="analytics"
                      className="data-[state=active]:bg-purple-500 data-[state=active]:text-white data-[state=active]:shadow-premium rounded-xl py-3 px-4 font-semibold transition-all duration-normal hover:bg-white/80"
                    >
                      Analytics
                    </TabsTrigger>
                  </TabsList>

                  <div className="bg-white/40 backdrop-blur-sm rounded-2xl border border-white/30 p-8">
                    <TabsContent value="overview" className="mt-0 space-y-8">
                      {/* Quick Stats */}
                      <div className="relative">
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-premium"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/80 to-teal-50/80 rounded-2xl"></div>
                        <div className="relative p-6">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 border border-emerald-200/50">
                              <BarChart3 className="h-5 w-5 text-emerald-600" />
                            </div>
                            <h3 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-emerald-800 to-teal-900 bg-clip-text text-transparent">
                              Asset Overview
                            </h3>
                          </div>
                          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                            <div className="group relative animate-fade-in-up">
                              <div className="absolute inset-0 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-premium group-hover:shadow-glow-subtle transition-all duration-normal"></div>
                              <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/80 to-green-50/80 border border-emerald-200/50 rounded-2xl"></div>
                              <div className="relative p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-bold text-slate-900 text-lg">Total Assets</h4>
                                  <div className="p-2 rounded-xl bg-emerald-100 border border-emerald-200">
                                    <Monitor className="h-5 w-5 text-emerald-600" />
                                  </div>
                                </div>
                                <div className="text-3xl font-bold text-emerald-600">{overview?.total_assets || 0}</div>
                                <p className="text-sm text-slate-600 font-medium">
                                  Equipment and property
                                </p>
                              </div>
                            </div>

                            <div className="group relative animate-fade-in-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
                              <div className="absolute inset-0 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-premium group-hover:shadow-glow-subtle transition-all duration-normal"></div>
                              <div className="absolute inset-0 bg-gradient-to-br from-green-50/80 to-lime-50/80 border border-green-200/50 rounded-2xl"></div>
                              <div className="relative p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-bold text-slate-900 text-lg">Active Assets</h4>
                                  <div className="p-2 rounded-xl bg-green-100 border border-green-200">
                                    <CheckCircle className="h-5 w-5 text-green-600" />
                                  </div>
                                </div>
                                <div className="text-3xl font-bold text-green-600">{overview?.active_assets || 0}</div>
                                <p className="text-sm text-slate-600 font-medium">
                                  Currently in use
                                </p>
                              </div>
                            </div>

                            <div className="group relative animate-fade-in-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
                              <div className="absolute inset-0 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-premium group-hover:shadow-glow-subtle transition-all duration-normal"></div>
                              <div className="absolute inset-0 bg-gradient-to-br from-teal-50/80 to-cyan-50/80 border border-teal-200/50 rounded-2xl"></div>
                              <div className="relative p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-bold text-slate-900 text-lg">Total Supplies</h4>
                                  <div className="p-2 rounded-xl bg-teal-100 border border-teal-200">
                                    <Box className="h-5 w-5 text-teal-600" />
                                  </div>
                                </div>
                                <div className="text-3xl font-bold text-teal-600">{overview?.total_supplies || 0}</div>
                                <p className="text-sm text-slate-600 font-medium">
                                  Consumable items
                                </p>
                              </div>
                            </div>

                            <div className="group relative animate-fade-in-up" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
                              <div className="absolute inset-0 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-premium group-hover:shadow-glow-subtle transition-all duration-normal"></div>
                              <div className="absolute inset-0 bg-gradient-to-br from-cyan-50/80 to-blue-50/80 border border-cyan-200/50 rounded-2xl"></div>
                              <div className="relative p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-bold text-slate-900 text-lg">Asset Value</h4>
                                  <div className="p-2 rounded-xl bg-cyan-100 border border-cyan-200">
                                    <DollarSign className="h-5 w-5 text-cyan-600" />
                                  </div>
                                </div>
                                <div className="text-3xl font-bold text-cyan-600">{formatCurrency(overview?.total_asset_value || 0)}</div>
                                <p className="text-sm text-slate-600 font-medium">
                                  Total investment
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                    </TabsContent>

                    <TabsContent value="assets" className="mt-0">
                      <AssetManagement />
                    </TabsContent>

                    <TabsContent value="supplies" className="mt-0">
                      <SupplyManagement />
                    </TabsContent>

                    <TabsContent value="maintenance" className="mt-0">
                      <MaintenanceManagement />
                    </TabsContent>

                    <TabsContent value="requests" className="mt-0">
                      <InventoryRequests />
                    </TabsContent>

                    <TabsContent value="analytics" className="mt-0">
                      <InventoryAnalytics />
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