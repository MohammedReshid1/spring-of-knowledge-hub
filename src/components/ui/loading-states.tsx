import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// Full Page Loading Overlay
export function FullPageLoader({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl p-12 shadow-2xl max-w-md w-full mx-4 animate-in zoom-in-95 duration-500">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 mb-6 animate-pulse">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mb-3">Please Wait</h3>
          <p className="text-slate-600">{message}</p>
        </div>
      </div>
    </div>
  );
}

// Card-based Loading State
export function CardLoader({
  title = 'Loading...',
  description,
  rows = 5
}: {
  title?: string;
  description?: string;
  rows?: number;
}) {
  return (
    <Card className="shadow-md animate-in fade-in duration-500">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
            {description && <p className="text-sm text-slate-600 mt-1">{description}</p>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// Table Loading Skeleton
export function TableLoader({ columns = 5, rows = 10 }: { columns?: number; rows?: number }) {
  return (
    <div className="animate-in fade-in duration-500">
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        {/* Table Header */}
        <div className="bg-slate-100 border-b border-slate-200 p-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        </div>
        {/* Table Rows */}
        <div className="divide-y divide-slate-200">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="p-4 bg-white hover:bg-slate-50 transition-colors">
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <Skeleton key={colIndex} className="h-4 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Inline Spinner
export function InlineSpinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}

// Stats Card Loading
export function StatsCardLoader({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-500">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <Skeleton className="h-8 w-16" />
            </div>
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Form Loading State
export function FormLoader({ fields = 6 }: { fields?: number }) {
  return (
    <Card className="shadow-md animate-in fade-in duration-500">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <Skeleton className="h-6 w-48" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <div className="flex gap-3 pt-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </CardContent>
    </Card>
  );
}

// List Loading State
export function ListLoader({ items = 8 }: { items?: number }) {
  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {Array.from({ length: items }).map((_, i) => (
        <Card key={i} className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Centered Page Loader
export function CenteredLoader({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[400px] animate-in fade-in duration-500">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 mb-4 animate-pulse">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        </div>
        <p className="text-lg font-medium text-slate-700">{message}</p>
      </div>
    </div>
  );
}
