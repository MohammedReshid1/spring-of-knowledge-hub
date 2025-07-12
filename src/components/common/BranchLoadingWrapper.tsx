import { ReactNode } from 'react';
import { useBranch } from '@/contexts/BranchContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface BranchLoadingWrapperProps {
  children: ReactNode;
  showLoadingCard?: boolean;
  loadingMessage?: string;
  customSkeleton?: ReactNode;
}

export const BranchLoadingWrapper = ({
  children,
  showLoadingCard = true,
  loadingMessage = "Loading branch data...",
  customSkeleton
}: BranchLoadingWrapperProps) => {
  const { isLoading } = useBranch();

  if (isLoading) {
    if (customSkeleton) {
      return <>{customSkeleton}</>;
    }

    if (showLoadingCard) {
      return (
        <div className="space-y-4 animate-fade-in">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
          <div className="text-center text-sm text-muted-foreground mt-4">
            {loadingMessage}
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center min-h-[400px] animate-fade-in">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <div className="text-sm text-muted-foreground">{loadingMessage}</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export const TableLoadingSkeleton = () => (
  <div className="space-y-3">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-8" />
      </div>
    ))}
  </div>
);

export const CardsLoadingSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <Card key={i}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-7 w-[60px] mb-1" />
          <Skeleton className="h-3 w-[80px]" />
        </CardContent>
      </Card>
    ))}
  </div>
);