import { useConsentService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import type { ConsentService } from '@src/features/identity/consent/apis/consent.service';
import { CONSENT_QUERY_KEYS } from '@src/features/identity/consent/constants/consent-query-keys';
import { queryOptions } from '@tanstack/react-query';

function getConsentQueryOptions(consentService: ConsentService) {
  return queryOptions({
    queryKey: CONSENT_QUERY_KEYS.consent(),
    queryFn: async ({ signal }) => {
      const result = await consentService.getConsent(signal);
      return unwrap(result);
    },
  });
}

export function useGetConsentQueryOptions() {
  return getConsentQueryOptions(useConsentService());
}
