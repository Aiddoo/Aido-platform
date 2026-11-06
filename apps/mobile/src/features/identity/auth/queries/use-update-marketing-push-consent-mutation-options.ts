import type { UpdateMarketingPushConsentInput } from '@aido/api';
import { useAuthService, useHaptics } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys';
import type { Consent } from '../domains/auth.model';

export const useUpdateMarketingPushConsentMutationOptions = () => {
  const haptics = useHaptics();
  const authService = useAuthService();
  const queryClient = useQueryClient();
  return mutationOptions({
    mutationFn: async (input: UpdateMarketingPushConsentInput) =>
      unwrap(await authService.updateMarketingPushConsent(input)),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: AUTH_QUERY_KEYS.consent() });
      const previousData = queryClient.getQueryData<Consent>(AUTH_QUERY_KEYS.consent());
      queryClient.setQueryData<Consent>(AUTH_QUERY_KEYS.consent(), (old) =>
        old ? { ...old, marketingPushAgreedAt: input.agreed ? new Date() : null } : old,
      );
      return { previousData };
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Consent>(AUTH_QUERY_KEYS.consent(), (old) =>
        old ? { ...old, marketingPushAgreedAt: data.marketingPushAgreedAt } : old,
      );
    },
    onError: (_error, _input, context) => {
      haptics.notify('error');
      if (context?.previousData) {
        queryClient.setQueryData(AUTH_QUERY_KEYS.consent(), context.previousData);
      }
    },
  });
};
