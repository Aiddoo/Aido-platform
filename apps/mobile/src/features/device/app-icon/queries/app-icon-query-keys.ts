import { queryOptions } from '@tanstack/react-query';

import type { AppIconKey } from '../domains/app-icon.model';

export const APP_ICON_QUERY_KEYS = {
  all: ['app-icon'] as const,
  current: () =>
    queryOptions<AppIconKey>({ queryKey: [...APP_ICON_QUERY_KEYS.all, 'current'] }).queryKey,
} as const;
