import { usePreferenceService } from '@src/bootstrap/providers/di-context';
import type { PreferenceService } from '@src/features/preference/apis/preference.service';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { PREFERENCE_QUERY_KEYS } from '../constants/preference-query-keys';

export function getPreferenceQueryOptions(preferenceService: PreferenceService) {
  return queryOptions({
    queryKey: PREFERENCE_QUERY_KEYS.current(),
    queryFn: async ({ signal }) => unwrap(await preferenceService.getPreference(signal)),
  });
}

export function useGetPreferenceQueryOptions() {
  return getPreferenceQueryOptions(usePreferenceService());
}
