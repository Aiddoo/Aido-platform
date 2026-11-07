import { useConsentService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { CONSENT_QUERY_KEYS } from '@src/features/identity/consent/constants/consent-query-keys';
import { queryOptions } from '@tanstack/react-query';

export function useGetConsentQueryOptions() {
  const consentService = useConsentService();

  return queryOptions({
    queryKey: CONSENT_QUERY_KEYS.consent(),
    queryFn: async ({ signal }) => unwrap(await consentService.getConsent(signal)),
  });
}
