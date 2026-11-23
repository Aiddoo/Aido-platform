import { useCallback, useState } from 'react';

export function useRefresh(refetch: () => Promise<unknown>) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  return [isRefreshing, handleRefresh] as const;
}
