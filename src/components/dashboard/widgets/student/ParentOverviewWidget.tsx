import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, User, ChevronRight, GraduationCap, AlertCircle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { WidgetProps } from '../WidgetRegistry';
import { useWidgetData } from '@/hooks/useWidgetData';
const mockChildren = [
  {
    id: 1,
    name: 'Emma Johnson',
    grade: 'Grade 10',
    class: '10A',
    status: 'active',
    recentGrade: { subject: 'Mathematics', score: 87, date: '2025-09-02' },
    attendance: { rate: 95, thisWeek: 5 },
    fees: { status: 'paid', amount: 0 },
    alerts: []
  },
  {
    id: 2,
    name: 'James Johnson',
    grade: 'Grade 8',
    class: '8B',
    status: 'active',
    recentGrade: { subject: 'Science', score: 92, date: '2025-09-01' },
    attendance: { rate: 88, thisWeek: 4 },
    fees: { status: 'pending', amount: 150 },
    alerts: ['Low attendance this week']
  },
  {
    id: 3,
    name: 'Sofia Johnson',
    grade: 'Grade 6',
    class: '6A',
    status: 'active',
    recentGrade: { subject: 'English', score: 94, date: '2025-08-30' },
    attendance: { rate: 97, thisWeek: 5 },
    fees: { status: 'paid', amount: 0 },
    alerts: []
  }
];

export const ParentOverviewWidget: React.FC<WidgetProps> = ({ config }) => {
  const { useParentOverview } = useWidgetData();
  const { data: childrenData, isLoading, error } = useParentOverview();
  const [selectedChild, setSelectedChild] = useState<number | null>(null);

  if (error) {
    return <div className="text-sm text-red-500">Failed to load children overview</div>;
  }

  const children = childrenData || [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="p-3 bg-gray-100 rounded animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  const totalAlerts = mockChildren.reduce((sum, child) => sum + child.alerts.length, 0);
  const unpaidFees = mockChildren.filter(child => child.fees.status !== 'paid').length;

  if (selectedChild) {
    const child = mockChildren.find(c => c.id === selectedChild);
    if (!child) return null;

    return (
      <div className="space-y-4">
        {/* Child Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedChild(null)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            ← Back to Overview
          </button>
        </div>

        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <User className="h-8 w-8 text-blue-600 mx-auto mb-2" />
          <div className="text-lg font-bold text-blue-900">{child.name}</div>
          <div className="text-sm text-blue-700">{child.grade} - Class {child.class}</div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-2 bg-green-50 rounded">
            <div className="text-lg font-bold text-green-900">{child.recentGrade.score}%</div>
            <div className="text-xs text-green-700">Latest Grade</div>
            <div className="text-xs text-gray-600">{child.recentGrade.subject}</div>
          </div>
          <div className="text-center p-2 bg-purple-50 rounded">
            <div className="text-lg font-bold text-purple-900">{child.attendance.rate}%</div>
            <div className="text-xs text-purple-700">Attendance</div>
            <div className="text-xs text-gray-600">{child.attendance.thisWeek}/5 this week</div>
          </div>
        </div>

        {/* Fee Status */}
        <div className={`p-3 rounded-lg border ${
          child.fees.status === 'paid' 
            ? 'bg-green-50 border-green-200' 
            : 'bg-orange-50 border-orange-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {child.fees.status === 'paid' ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-orange-600" />
              )}
              <span className="text-sm font-medium">Fee Status</span>
            </div>
            <Badge className={
              child.fees.status === 'paid' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-orange-100 text-orange-800'
            }>
              {child.fees.status === 'paid' ? 'Paid' : `$${child.fees.amount} Due`}
            </Badge>
          </div>
        </div>

        {/* Alerts */}
        {child.alerts.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">Alerts</div>
            {child.alerts.map((alert, index) => (
              <div key={index} className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                <AlertCircle className="h-3 w-3 inline mr-1" />
                {alert}
              </div>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2">
          <Link 
            to={`/students/${child.id}/grades`}
            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-center"
          >
            View Grades
          </Link>
          <Link 
            to={`/students/${child.id}/attendance`}
            className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 text-center"
          >
            Attendance
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center p-2 bg-blue-50 rounded-lg">
          <Users className="h-5 w-5 text-blue-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-blue-900">{mockChildren.length}</div>
          <div className="text-xs text-blue-700">Children</div>
        </div>
        <div className="text-center p-2 bg-red-50 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-red-900">{totalAlerts}</div>
          <div className="text-xs text-red-700">Alerts</div>
        </div>
      </div>

      {/* Children List */}
      <div className="space-y-2">
        {mockChildren.map((child) => (
          <div
            key={child.id}
            onClick={() => setSelectedChild(child.id)}
            className="p-3 rounded-lg border bg-white hover:border-blue-200 hover:bg-blue-50 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-900">{child.name}</span>
                <Badge variant="outline" className="text-xs">
                  {child.grade}
                </Badge>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </div>

            <div className="flex items-center justify-between text-xs text-gray-600">
              <div className="flex items-center gap-3">
                <span>Latest: {child.recentGrade.score}% ({child.recentGrade.subject})</span>
                <span>•</span>
                <span>Attendance: {child.attendance.rate}%</span>
              </div>
              
              <div className="flex items-center gap-1">
                {child.fees.status !== 'paid' && (
                  <Badge className="bg-orange-100 text-orange-800 text-xs">
                    Fee Due
                  </Badge>
                )}
                {child.alerts.length > 0 && (
                  <Badge className="bg-red-100 text-red-800 text-xs">
                    {child.alerts.length} Alert{child.alerts.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Overall Alerts */}
      {unpaidFees > 0 && (
        <div className="p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
          <AlertCircle className="h-3 w-3 inline mr-1" />
          {unpaidFees} child{unpaidFees !== 1 ? 'ren have' : ' has'} outstanding fees
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t">
        <Link 
          to="/parent-portal"
          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-center"
        >
          Full Portal
        </Link>
        <Link 
          to="/payments"
          className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-center"
        >
          Make Payment
        </Link>
      </div>
    </div>
  );
};