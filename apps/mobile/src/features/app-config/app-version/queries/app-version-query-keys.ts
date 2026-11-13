import { queryOptions } from '@tanstack/react-query';

import type { AppVersionConfig } from '../domains/app-version.model';

export const APP_VERSION_QUERY_KEYS = {
  all: ['app-version'] as const,
  config: () =>
    queryOptions<AppVersionConfig>({ queryKey: [...APP_VERSION_QUERY_KEYS.all, 'config'] })
      .queryKey,
} as const;
