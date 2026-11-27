import { type TimeFormat, USER_PREFERENCE_DEFAULTS } from '@aido/api/vocabulary';
import { usePreferenceApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { queryOptions } from '@tanstack/react-query';

import type { Preference } from '../domains/preference.model';
import { PREFERENCE_QUERY_KEYS } from './preference-query-keys';

export function useGetPreferenceQueryOptions() {
  const preferenceApi = usePreferenceApi();

  return queryOptions({
    queryKey: PREFERENCE_QUERY_KEYS.current(),
    queryFn: async ({ signal }) => unwrap(await preferenceApi.getPreference(signal)),
    ...PERSISTED_QUERY_OPTIONS,
    // 알림 시각 선택처럼 프리미엄 전용 설정이 있어 프리미엄이 바뀌면 서버 값을 다시 받는다
    meta: { ...PERSISTED_QUERY_OPTIONS.meta, refreshOnPremiumChange: true },
  });
}

/** 설정을 아직 받지 못했으면(기다리지 않는 화면·받지 않고 캐시만 읽는 훅) 서버 기본 표기다 */
export function selectTimeFormat(preference: Preference | undefined): TimeFormat {
  return preference?.timeFormat ?? USER_PREFERENCE_DEFAULTS.TIME_FORMAT;
}
