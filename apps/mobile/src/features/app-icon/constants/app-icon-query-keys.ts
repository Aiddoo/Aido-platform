export const APP_ICON_QUERY_KEYS = {
  all: ['app-icon'] as const,
  current: () => [...APP_ICON_QUERY_KEYS.all, 'current'] as const,
};
