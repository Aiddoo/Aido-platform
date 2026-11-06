import type { UpdateMarketingPushConsentInput } from '@aido/api';
import { useConsentService, useHaptics } from '@src/bootstrap/providers/di-context';
import { CONSENT_QUERY_KEYS } from '@src/features/identity/consent/constants/consent-query-keys';
import type { Consent } from '@src/features/identity/consent/domains/consent.model';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

export const useUpdateMarketingPushConsentMutationOptions = () => {
  const haptics = useHaptics();
  const consentService = useConsentService();
  const queryClient = useQueryClient();
  return mutationOptions({
    mutationFn: async (input: UpdateMarketingPushConsentInput) =>
      unwrap(await consentService.updateMarketingPushConsent(input)),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: CONSENT_QUERY_KEYS.consent() });
      const previousData = queryClient.getQueryData<Consent>(CONSENT_QUERY_KEYS.consent());
      queryClient.setQueryData<Consent>(CONSENT_QUERY_KEYS.consent(), (old) =>
        old ? { ...old, marketingPushAgreedAt: input.agreed ? new Date() : null } : old,
      );
      return { previousData };
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Consent>(CONSENT_QUERY_KEYS.consent(), (old) =>
        old ? { ...old, marketingPushAgreedAt: data.marketingPushAgreedAt } : old,
      );
    },
    onError: (_error, _input, context) => {
      haptics.notify('error');
      if (context?.previousData) {
        queryClient.setQueryData(CONSENT_QUERY_KEYS.consent(), context.previousData);
      }
    },
  });
};
