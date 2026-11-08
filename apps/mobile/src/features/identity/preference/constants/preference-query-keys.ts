import { queryOptions } from '@tanstack/react-query';

import type { Preference } from '../domains/preference.model';

export const PREFERENCE_QUERY_KEYS = {
  all: ['preference'] as const,
  current: () =>
    queryOptions<Preference>({ queryKey: [...PREFERENCE_QUERY_KEYS.all, 'current'] }).queryKey,
} as const;
