import { useCallback, useState } from 'react';

export function useRefresh(refetch: () => Promise<unknown>) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // React Compiler가 catch 없는 try를 다루지 못해 이 훅을 건너뛰므로 손으로 메모한다
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
