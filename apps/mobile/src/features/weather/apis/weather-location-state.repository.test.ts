import type { SyncStorage } from '@src/core/ports/sync-storage';

import { createWeatherLocationStateRepository } from './weather-location-state.repository';

function createMemoryStorage(): SyncStorage {
  const values = new Map<string, string>();
  return {
    getString: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
    delete: (key) => values.delete(key),
  };
}

describe('WeatherLocationStateRepository', () => {
  it('안내를 확인하기 전에는 보지 않은 상태이고 표시 후에는 기존 키로 저장한다', () => {
    // Given
    const storage = createMemoryStorage();
    const repository = createWeatherLocationStateRepository(storage);

    // When
    const before = repository.hasSeenIntroduction();
    repository.markIntroductionSeen();

    // Then
    expect(before).toBe(false);
    expect(repository.hasSeenIntroduction()).toBe(true);
    expect(storage.getString('aido_weather_location_introduction_v1')).toBe('seen');
  });
});
