import type { PreferenceResponse, UpdatePreferenceInput } from '@aido/validators';
import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys.constant';

/**
 * Hook for updating user preference
 */
export const useUpdatePreference = () => {
  const authService = useAuthService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdatePreferenceInput) => authService.updatePreference(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: AUTH_QUERY_KEYS.preference() });

      const previousData = queryClient.getQueryData<PreferenceResponse>(
        AUTH_QUERY_KEYS.preference(),
      );

      queryClient.setQueryData<PreferenceResponse>(AUTH_QUERY_KEYS.preference(), (old) => {
        if (!old) return old;
        return { ...old, ...input };
      });

      return { previousData };
    },
    onSuccess: (data) => {
      queryClient.setQueryData<PreferenceResponse>(AUTH_QUERY_KEYS.preference(), data);
    },
    onError: (_error, _input, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(AUTH_QUERY_KEYS.preference(), context.previousData);
      }
    },
  });
};
