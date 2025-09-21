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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Inventory & Asset Management</h1>
        <p className="text-muted-foreground">Manage assets, supplies, maintenance, and procurement</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="supplies">Supplies</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Assets"
              value={overview?.total_assets || 0}
              icon={Monitor}
              description="Equipment and property"
              color="blue"
            />
            <StatCard
              title="Active Assets"
              value={overview?.active_assets || 0}
              icon={CheckCircle}
              description="Currently in use"
              color="green"
            />
            <StatCard
              title="Total Supplies"
              value={overview?.total_supplies || 0}
              icon={Box}
              description="Consumable items"
              color="purple"
            />
            <StatCard
              title="Asset Value"
              value={formatCurrency(overview?.total_asset_value || 0)}
              icon={DollarSign}
              description="Total investment"
              color="emerald"
            />
          </div>

          {/* System Health Indicators */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Asset Utilization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold mb-2 ${getHealthColor(overview?.system_health.asset_utilization || 0)}`}>
                  {overview?.system_health.asset_utilization.toFixed(1) || 0}%
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Assets actively deployed and in use
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      (overview?.system_health.asset_utilization || 0) >= 90 ? 'bg-green-600' :
                      (overview?.system_health.asset_utilization || 0) >= 70 ? 'bg-yellow-600' : 'bg-red-600'
                    }`}
                    style={{ width: `${overview?.system_health.asset_utilization || 0}%` }}
                  ></div>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {overview?.active_assets || 0} of {overview?.total_assets || 0} assets active
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Wrench className="h-5 w-5 mr-2" />
                  Maintenance Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold mb-2 ${getHealthColor(overview?.system_health.maintenance_compliance || 0)}`}>
                  {overview?.system_health.maintenance_compliance.toFixed(1) || 0}%
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Maintenance schedule compliance
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      (overview?.system_health.maintenance_compliance || 0) >= 90 ? 'bg-green-600' :
                      (overview?.system_health.maintenance_compliance || 0) >= 70 ? 'bg-yellow-600' : 'bg-red-600'
                    }`}
                    style={{ width: `${overview?.system_health.maintenance_compliance || 0}%` }}
                  ></div>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {(overview?.pending_maintenance || 0) - (overview?.overdue_maintenance || 0)} on schedule, {overview?.overdue_maintenance || 0} overdue
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Package className="h-5 w-5 mr-2" />
                  Stock Adequacy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold mb-2 ${getHealthColor(overview?.system_health.stock_adequacy || 0)}`}>
                  {overview?.system_health.stock_adequacy.toFixed(1) || 0}%
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Supplies above minimum levels
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      (overview?.system_health.stock_adequacy || 0) >= 90 ? 'bg-green-600' :
                      (overview?.system_health.stock_adequacy || 0) >= 70 ? 'bg-yellow-600' : 'bg-red-600'
                    }`}
                    style={{ width: `${overview?.system_health.stock_adequacy || 0}%` }}
                  ></div>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {overview?.low_stock_supplies || 0} items need restocking
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Category Distribution and Alerts */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Asset Categories
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overview?.category_distribution ? (
                  <div className="space-y-3">
                    {Object.entries(overview.category_distribution)
                      .sort(([,a], [,b]) => b - a)
                      .map(([category, count]) => (
                        <div key={category} className="flex justify-between items-center">
                          <span className="text-sm capitalize">{category.replace('_', ' ')}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{ width: `${(count / Math.max(...Object.values(overview.category_distribution))) * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-bold">{count}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No category data available</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  System Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(overview?.overdue_maintenance || 0) > 0 && (
                    <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium text-red-800">Overdue Maintenance</span>
                      </div>
                      <Badge className="bg-red-100 text-red-800">
                        {overview?.overdue_maintenance || 0} items
                      </Badge>
                    </div>
                  )}

                  {(overview?.low_stock_supplies || 0) > 0 && (
                    <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Package className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm font-medium text-yellow-800">Low Stock Alert</span>
                      </div>
                      <Badge className="bg-yellow-100 text-yellow-800">
                        {overview?.low_stock_supplies || 0} items
                      </Badge>
                    </div>
                  )}

                  {(overview?.assets_under_maintenance || 0) > 0 && (
                    <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Wrench className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">Under Maintenance</span>
                      </div>
                      <Badge className="bg-blue-100 text-blue-800">
                        {overview?.assets_under_maintenance || 0} assets
                      </Badge>
                    </div>
                  )}

                  {(overview?.overdue_maintenance || 0) === 0 && 
                   (overview?.low_stock_supplies || 0) === 0 && 
                   (overview?.assets_under_maintenance || 0) === 0 && (
                    <div className="text-center py-4">
                      <CheckCircle className="h-8 w-8 mx-auto text-green-600 mb-2" />
                      <p className="text-sm text-green-700">All systems operational</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Button 
                  variant="outline" 
                  className="h-20 flex flex-col items-center justify-center"
                  onClick={() => setActiveTab('assets')}
                >
                  <Monitor className="h-6 w-6 mb-2" />
                  Add Asset
                </Button>

                <Button 
                  variant="outline" 
                  className="h-20 flex flex-col items-center justify-center"
                  onClick={() => setActiveTab('supplies')}
                >
                  <Package className="h-6 w-6 mb-2" />
                  Manage Supplies
                </Button>

                <Button 
                  variant="outline" 
                  className="h-20 flex flex-col items-center justify-center"
                  onClick={() => setActiveTab('maintenance')}
                >
                  <Wrench className="h-6 w-6 mb-2" />
                  Schedule Maintenance
                </Button>

                <Button 
                  variant="outline" 
                  className="h-20 flex flex-col items-center justify-center"
                  onClick={() => setActiveTab('requests')}
                >
                  <Settings className="h-6 w-6 mb-2" />
                  Create Request
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assets">
          <AssetManagement />
        </TabsContent>

        <TabsContent value="supplies">
          <SupplyManagement />
        </TabsContent>

        <TabsContent value="maintenance">
          <MaintenanceManagement />
        </TabsContent>

        <TabsContent value="requests">
          <InventoryRequests />
        </TabsContent>

        <TabsContent value="analytics">
          <InventoryAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  );
};