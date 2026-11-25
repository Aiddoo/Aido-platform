export const APP_ICON_MUTATION_KEYS = {
  all: ['app-icon', 'mutation'] as const,
  changeAppIcon: () => [...APP_ICON_MUTATION_KEYS.all, 'change-app-icon'] as const,
} as const;
