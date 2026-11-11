import { usePreferenceService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { queryOptions } from '@tanstack/react-query';

import { PREFERENCE_QUERY_KEYS } from './preference-query-keys';

export function useGetPreferenceQueryOptions() {
  const preferenceService = usePreferenceService();

  return queryOptions({
    queryKey: PREFERENCE_QUERY_KEYS.current(),
    queryFn: async ({ signal }) => unwrap(await preferenceService.getPreference(signal)),
    ...PERSISTED_QUERY_OPTIONS,
    // 알림 시각 선택처럼 프리미엄 전용 설정이 있어 프리미엄이 바뀌면 서버 값을 다시 받는다
    meta: { ...PERSISTED_QUERY_OPTIONS.meta, refreshOnPremiumChange: true },
  });
}
