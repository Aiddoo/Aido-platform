import type { UpdatePreferenceInput } from '@aido/validators';
import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import type { Preference } from '../../models/auth.model';
import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys.constant';

export const updatePreferenceMutationOptions = () => {
  const authService = useAuthService();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async (input: UpdatePreferenceInput) => {
      const result = await authService.updatePreference(input);
      return unwrap(result);
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: AUTH_QUERY_KEYS.preference() });

      const previousData = queryClient.getQueryData<Preference>(AUTH_QUERY_KEYS.preference());

      queryClient.setQueryData<Preference>(AUTH_QUERY_KEYS.preference(), (old) => {
        if (!old) return old;
        return { ...old, ...input };
      });

      return { previousData };
    },
    onSuccess: (data) => {
      // 서버 응답으로 캐시를 정확하게 업데이트 (invalidate 대신 직접 업데이트로 블링킹 방지)
      queryClient.setQueryData<Preference>(AUTH_QUERY_KEYS.preference(), data);
    },
    onError: (_error, _input, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(AUTH_QUERY_KEYS.preference(), context.previousData);
      }
    },
  });
};
