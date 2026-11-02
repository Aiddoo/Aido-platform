import type { SyncStorage } from '@src/core/ports/sync-storage';

/** 설치된 앱의 안내 확인 기록을 이어 쓰도록 이전 키 이름을 그대로 둔다. */
const INTRODUCTION_KEY = 'aido_weather_location_introduction_v1';

export interface WeatherIntroductionRepository {
  hasSeenIntroduction(): boolean;
  markIntroductionSeen(): void;
}

export function createWeatherIntroductionRepository(
  storage: SyncStorage,
): WeatherIntroductionRepository {
  return {
    hasSeenIntroduction: () => storage.getString(INTRODUCTION_KEY) === 'seen',
    markIntroductionSeen: () => {
      storage.set(INTRODUCTION_KEY, 'seen');
    },
  };
}
