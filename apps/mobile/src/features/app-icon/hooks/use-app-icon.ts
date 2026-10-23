import { useAppIconService } from '@src/bootstrap/providers/di-context';
import { useMutation, useQuery } from '@tanstack/react-query';

import { useGetCurrentAppIconQueryOptions } from '../queries/get-current-app-icon-query-options';
import { useChangeAppIconMutationOptions } from '../queries/use-change-app-icon-mutation-options';

export function useAppIcon() {
  const service = useAppIconService();
  const currentIconQuery = useQuery(useGetCurrentAppIconQueryOptions());
  const changeIconMutation = useMutation(useChangeAppIconMutationOptions());
  const isSupported = service.isSupported();

  return {
    currentIcon: currentIconQuery.data ?? 'default',
    isSupported,
    isLoading: isSupported && currentIconQuery.isPending,
    isChanging: changeIconMutation.isPending,
    changeIcon: changeIconMutation.mutate,
    changeError: changeIconMutation.error,
    resetChangeError: changeIconMutation.reset,
  };
}
