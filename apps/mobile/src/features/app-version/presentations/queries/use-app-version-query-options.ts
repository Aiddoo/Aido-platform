import { useAppVersionService } from '@src/bootstrap/providers/di-context';
import { queryOptions } from '@tanstack/react-query';

export const useAppVersionQueryOptions = () => {
  const service = useAppVersionService();
  return queryOptions({
    queryKey: ['app-version', 'config'] as const,
    queryFn: service.getConfig,
    retry: false,
    staleTime: 0,
  });
};
