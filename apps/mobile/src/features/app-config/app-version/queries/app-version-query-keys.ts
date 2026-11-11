export const APP_VERSION_QUERY_KEYS = {
  all: ['app-version'] as const,
  config: () => [...APP_VERSION_QUERY_KEYS.all, 'config'] as const,
} as const;
