export const APP_VERSION_MUTATION_KEYS = {
  all: ['app-version', 'mutation'] as const,
  openStoreListing: () => [...APP_VERSION_MUTATION_KEYS.all, 'open-store-listing'] as const,
} as const;
