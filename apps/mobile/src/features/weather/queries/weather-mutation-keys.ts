export const WEATHER_MUTATION_KEYS = {
  all: ['weather', 'mutation'] as const,
  updateWeatherLocation: () => [...WEATHER_MUTATION_KEYS.all, 'update-weather-location'] as const,
} as const;
