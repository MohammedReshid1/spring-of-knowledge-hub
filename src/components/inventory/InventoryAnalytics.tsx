import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Package,
  Monitor,
  Wrench,
  AlertTriangle,
  CheckCircle,
  Activity,
  PieChart,
  Calendar
} from 'lucide-react';
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

export const InventoryAnalytics: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('30_days');
  const { selectedBranch, isHQRole } = useBranch();

  const { data: overview, isLoading } = useQuery<InventoryOverview>({
    queryKey: ['inventory-analytics-overview', selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (isHQRole && selectedBranch && selectedBranch !== 'all') {
        params.append('branch_id', selectedBranch);
      }
      const response = await apiClient.get(`/inventory/analytics/overview${params.toString() ? `?${params.toString()}` : ''}`);
      return response.data;
    },
    enabled: !isHQRole || !!selectedBranch,
  });

  const { data: assets = [] } = useQuery({
    queryKey: ['assets', selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (isHQRole && selectedBranch && selectedBranch !== 'all') {
        params.append('branch_id', selectedBranch);
      }
      const response = await apiClient.get(`/inventory/assets${params.toString() ? `?${params.toString()}` : ''}`);
      return response.data;
    },
    enabled: !isHQRole || !!selectedBranch,
  });

  const { data: supplies = [] } = useQuery({
    queryKey: ['supplies', selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (isHQRole && selectedBranch && selectedBranch !== 'all') {
        params.append('branch_id', selectedBranch);
      }
      const response = await apiClient.get(`/inventory/supplies${params.toString() ? `?${params.toString()}` : ''}`);
      return response.data;
    },
    enabled: !isHQRole || !!selectedBranch,
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading analytics...</div>;
  }

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

  const getHealthBadgeColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-green-100 text-green-800';
    if (percentage >= 70) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getTrendIcon = (current: number, target: number) => {
    if (current > target) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (current < target) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Activity className="h-4 w-4 text-blue-600" />;
  };

  // Calculate asset condition distribution
  const assetConditionStats = assets.reduce((acc: Record<string, number>, asset: any) => {
    const condition = asset.condition || 'unknown';
    acc[condition] = (acc[condition] || 0) + 1;
    return acc;
  }, {});

  // Calculate supply stock levels
  const supplyStockStats = supplies.reduce((acc: any, supply: any) => {
    if (supply.current_stock <= supply.minimum_stock) {
      acc.low_stock++;
    } else if (supply.current_stock <= supply.minimum_stock * 1.5) {
      acc.medium_stock++;
    } else {
      acc.high_stock++;
    }
    return acc;
  }, { low_stock: 0, medium_stock: 0, high_stock: 0 });

  // Calculate average asset age
  const averageAssetAge = assets.length > 0 
    ? assets.reduce((acc: number, asset: any) => {
        if (asset.purchase_date) {
          const purchaseDate = new Date(asset.purchase_date);
          const ageInDays = Math.floor((Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
          return acc + ageInDays;
        }
        return acc;
      }, 0) / assets.length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold">Inventory Analytics</h2>
          <p className="text-muted-foreground">Comprehensive insights into asset and supply management</p>
        </div>
        
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select time period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7_days">Last 7 days</SelectItem>
            <SelectItem value="30_days">Last 30 days</SelectItem>
            <SelectItem value="90_days">Last 90 days</SelectItem>
            <SelectItem value="1_year">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <Monitor className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.total_assets || 0}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {getTrendIcon(overview?.total_assets || 0, 50)}
              <span className="ml-1">+12% from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Assets</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.active_assets || 0}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <span>
                {overview?.total_assets ? 
                  `${((overview.active_assets / overview.total_assets) * 100).toFixed(1)}% utilization` 
                  : 'No data'
                }
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(overview?.total_asset_value || 0)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-green-600 mr-1" />
              <span>+8% from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maintenance Due</CardTitle>
            <Wrench className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.pending_maintenance || 0}</div>
            <div className="flex items-center text-xs">
              {(overview?.overdue_maintenance || 0) > 0 && (
                <span className="text-red-600">
                  {overview?.overdue_maintenance} overdue
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            System Health Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Asset Utilization</span>
                <Badge className={getHealthBadgeColor(overview?.system_health.asset_utilization || 0)}>
                  {overview?.system_health.asset_utilization?.toFixed(1) || 0}%
                </Badge>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    (overview?.system_health.asset_utilization || 0) >= 90 ? 'bg-green-600' :
                    (overview?.system_health.asset_utilization || 0) >= 70 ? 'bg-yellow-600' : 'bg-red-600'
                  }`}
                  style={{ width: `${overview?.system_health.asset_utilization || 0}%` }}
                ></div>
              </div>
              <p className="text-xs text-muted-foreground">
                {overview?.active_assets || 0} of {overview?.total_assets || 0} assets in use
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Maintenance Compliance</span>
                <Badge className={getHealthBadgeColor(overview?.system_health.maintenance_compliance || 0)}>
                  {overview?.system_health.maintenance_compliance?.toFixed(1) || 0}%
                </Badge>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    (overview?.system_health.maintenance_compliance || 0) >= 90 ? 'bg-green-600' :
                    (overview?.system_health.maintenance_compliance || 0) >= 70 ? 'bg-yellow-600' : 'bg-red-600'
                  }`}
                  style={{ width: `${overview?.system_health.maintenance_compliance || 0}%` }}
                ></div>
              </div>
              <p className="text-xs text-muted-foreground">
                {overview?.overdue_maintenance || 0} overdue items
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Stock Adequacy</span>
                <Badge className={getHealthBadgeColor(overview?.system_health.stock_adequacy || 0)}>
                  {overview?.system_health.stock_adequacy?.toFixed(1) || 0}%
                </Badge>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    (overview?.system_health.stock_adequacy || 0) >= 90 ? 'bg-green-600' :
                    (overview?.system_health.stock_adequacy || 0) >= 70 ? 'bg-yellow-600' : 'bg-red-600'
                  }`}
                  style={{ width: `${overview?.system_health.stock_adequacy || 0}%` }}
                ></div>
              </div>
              <p className="text-xs text-muted-foreground">
                {overview?.low_stock_supplies || 0} items need restocking
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Analytics */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Asset Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <PieChart className="h-5 w-5 mr-2" />
              Asset Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overview?.category_distribution ? (
              <div className="space-y-3">
                {Object.entries(overview.category_distribution)
                  .sort(([,a], [,b]) => b - a)
                  .map(([category, count]) => {
                    const maxCount = Math.max(...Object.values(overview.category_distribution));
                    const percentage = ((count / (overview?.total_assets || 1)) * 100).toFixed(1);
                    
                    return (
                      <div key={category} className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium capitalize">
                            {category.replace('_', ' ')}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">{percentage}%</span>
                            <span className="text-sm font-bold">{count}</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${(count / maxCount) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No category data available</p>
            )}
          </CardContent>
        </Card>

        {/* Asset Condition Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              Asset Condition Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(assetConditionStats).map(([condition, count]) => {
                const percentage = ((count / assets.length) * 100).toFixed(1);
                const colorClass = {
                  'excellent': 'bg-green-600',
                  'good': 'bg-blue-600',
                  'fair': 'bg-yellow-600',
                  'poor': 'bg-orange-600',
                  'broken': 'bg-red-600',
                  'unknown': 'bg-gray-600'
                }[condition] || 'bg-gray-600';

                return (
                  <div key={condition} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium capitalize">{condition}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{percentage}%</span>
                        <span className="text-sm font-bold">{count}</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${colorClass}`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Supply Stock Levels */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="h-5 w-5 mr-2" />
              Supply Stock Levels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
                  <span className="text-sm font-medium">Low Stock</span>
                </div>
                <Badge variant="destructive">{supplyStockStats.low_stock}</Badge>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center">
                  <Package className="h-4 w-4 text-yellow-600 mr-2" />
                  <span className="text-sm font-medium">Medium Stock</span>
                </div>
                <Badge className="bg-yellow-100 text-yellow-800">{supplyStockStats.medium_stock}</Badge>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                  <span className="text-sm font-medium">Good Stock</span>
                </div>
                <Badge className="bg-green-100 text-green-800">{supplyStockStats.high_stock}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Key Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center mb-2">
                  <Calendar className="h-4 w-4 text-blue-600 mr-2" />
                  <span className="text-sm font-medium">Asset Age</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Average asset age: {Math.round(averageAssetAge / 365 * 10) / 10} years
                </p>
              </div>

              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center mb-2">
                  <TrendingUp className="h-4 w-4 text-green-600 mr-2" />
                  <span className="text-sm font-medium">Performance</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {overview?.system_health.asset_utilization && overview.system_health.asset_utilization >= 80
                    ? "Excellent asset utilization rate"
                    : "Consider optimizing asset deployment"
                  }
                </p>
              </div>

              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center mb-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600 mr-2" />
                  <span className="text-sm font-medium">Recommendations</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {(overview?.overdue_maintenance || 0) > 0
                    ? `Address ${overview?.overdue_maintenance} overdue maintenance items`
                    : (overview?.low_stock_supplies || 0) > 0
                    ? `Restock ${overview?.low_stock_supplies} supply items`
                    : "All systems operating efficiently"
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
