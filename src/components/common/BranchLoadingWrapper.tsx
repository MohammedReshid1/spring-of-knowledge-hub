import { ReactNode } from 'react';
import { useBranch } from '@/contexts/BranchContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PageLoading, ContentLoading, TableLoading, WidgetLoading } from '@/components/ui/loading';

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
      return <ContentLoading message={loadingMessage} />;
    }

    return <PageLoading message={loadingMessage} />;
  }

  return <>{children}</>;
};

export const TableLoadingSkeleton = () => <TableLoading />;

export const CardsLoadingSkeleton = () => <WidgetLoading count={4} />;