import { useConsentService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { CONSENT_QUERY_KEYS } from './consent-query-keys';

export function useGetConsentQueryOptions() {
  const consentService = useConsentService();

  return queryOptions({
    queryKey: CONSENT_QUERY_KEYS.detail(),
    queryFn: async ({ signal }) => unwrap(await consentService.getConsent(signal)),
  });
}
