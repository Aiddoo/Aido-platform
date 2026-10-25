import type { WeatherLocationStateRepository } from './weather-location-state.repository';

export class WeatherLocationStateService {
  readonly #repository: WeatherLocationStateRepository;

  constructor(repository: WeatherLocationStateRepository) {
    this.#repository = repository;
  }

  hasSeenIntroduction = (): boolean => this.#repository.hasSeenIntroduction();
  markIntroductionSeen = (): void => {
    this.#repository.markIntroductionSeen();
  };
}
