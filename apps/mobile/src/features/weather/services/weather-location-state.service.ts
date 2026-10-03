import type { SyncStorage } from '@src/core/ports/sync-storage';

const INTRODUCTION_KEY = 'aido_weather_location_introduction_v1';

export class WeatherLocationStateService {
  readonly #storage: SyncStorage;

  constructor(storage: SyncStorage) {
    this.#storage = storage;
  }

  hasSeenIntroduction = (): boolean => this.#storage.getString(INTRODUCTION_KEY) === 'seen';
  markIntroductionSeen = (): void => {
    this.#storage.set(INTRODUCTION_KEY, 'seen');
  };
}
