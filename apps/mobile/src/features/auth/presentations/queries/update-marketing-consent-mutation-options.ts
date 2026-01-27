import type { ConsentResponse, UpdateMarketingConsentInput } from '@aido/validators';
import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys.constant';

export const updateMarketingConsentMutationOptions = () => {
  const authService = useAuthService();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: (input: UpdateMarketingConsentInput) => authService.updateMarketingConsent(input),

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: AUTH_QUERY_KEYS.consent() });

      const previousData = queryClient.getQueryData<ConsentResponse>(AUTH_QUERY_KEYS.consent());

      queryClient.setQueryData<ConsentResponse>(AUTH_QUERY_KEYS.consent(), (old) => {
        if (!old) return old;
        return {
          ...old,
          marketingAgreedAt: input.agreed ? new Date().toISOString() : null,
        };
      });

      return { previousData };
    },

    onSuccess: (data) => {
      queryClient.setQueryData<ConsentResponse>(AUTH_QUERY_KEYS.consent(), (old) => {
        if (!old) return old;
        return {
          ...old,
          marketingAgreedAt: data.marketingAgreedAt,
        };
      });
    },

    onError: (_error, _input, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(AUTH_QUERY_KEYS.consent(), context.previousData);
      }
    },
  });
};
