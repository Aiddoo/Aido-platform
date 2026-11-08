import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';

/** 설치된 앱의 안내 확인 기록을 이어 쓰도록 이전 키 이름을 그대로 둔다. */
const INTRODUCTION_KEY = 'aido_weather_location_introduction_v1';

export interface WeatherIntroductionRepository {
  hasSeenIntroduction(): boolean;
  markIntroductionSeen(): void;
  subscribe(listener: () => void): () => void;
}

export function createWeatherIntroductionRepository(
  storage: ObservableSyncStorage,
): WeatherIntroductionRepository {
  return {
    hasSeenIntroduction: () => storage.get(INTRODUCTION_KEY) === 'seen',
    markIntroductionSeen: () => {
      try {
        storage.set(INTRODUCTION_KEY, 'seen');
      } catch {
        // 저장하지 못하면 소개가 한 번 더 보일 뿐이다.
      }
    },
    subscribe: (listener) => storage.subscribe(INTRODUCTION_KEY, listener),
  };
}
