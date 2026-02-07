import { useCallback, useState } from 'react';

export const useRefresh = (refetchFn: () => Promise<unknown>) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetchFn();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchFn]);

  return [isRefreshing, handleRefresh] as const;
};
