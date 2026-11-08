import { queryOptions } from '@tanstack/react-query';

import type { Preference } from '../domains/preference.model';

export const PREFERENCE_QUERY_KEYS = {
  all: ['preference'] as const,
  // 캐시를 직접 읽고 쓰는 키는 데이터 타입을 붙여 getQueryData·setQueryData가 타입을 안다
  current: () =>
    queryOptions<Preference>({ queryKey: [...PREFERENCE_QUERY_KEYS.all, 'current'] }).queryKey,
} as const;
