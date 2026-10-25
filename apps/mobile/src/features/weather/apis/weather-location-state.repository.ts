import type { SyncStorage } from '@src/core/ports/sync-storage';

const INTRODUCTION_KEY = 'aido_weather_location_introduction_v1';

export interface WeatherLocationStateRepository {
  hasSeenIntroduction(): boolean;
  markIntroductionSeen(): void;
}

export function createWeatherLocationStateRepository(
  storage: SyncStorage,
): WeatherLocationStateRepository {
  return {
    hasSeenIntroduction: () => storage.getString(INTRODUCTION_KEY) === 'seen',
    markIntroductionSeen: () => {
      storage.set(INTRODUCTION_KEY, 'seen');
    },
  };
}
