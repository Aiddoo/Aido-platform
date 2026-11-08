import { createMemoryObservableSyncStorage } from '@src/shared/__tests__';

import { createWeatherIntroductionRepository } from './weather-introduction.repository';

describe('WeatherIntroductionRepository', () => {
  it('안내를 확인하기 전에는 보지 않은 상태이고 표시 후에는 이전 버전과 같은 키로 저장한다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    const repository = createWeatherIntroductionRepository(storage);

    // When
    const before = repository.hasSeenIntroduction();
    repository.markIntroductionSeen();

    // Then
    expect(before).toBe(false);
    expect(repository.hasSeenIntroduction()).toBe(true);
    expect(storage.get('aido_weather_location_introduction_v1')).toBe('seen');
  });

  it('이전 버전에서 안내를 본 기록이 있으면 다시 보여 주지 않는다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    storage.set('aido_weather_location_introduction_v1', 'seen');

    // When
    const seen = createWeatherIntroductionRepository(storage).hasSeenIntroduction();

    // Then
    expect(seen).toBe(true);
  });
});
