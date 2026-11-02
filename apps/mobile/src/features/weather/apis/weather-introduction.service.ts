import type { WeatherIntroductionRepository } from './weather-introduction.repository';

export class WeatherIntroductionService {
  readonly #repository: WeatherIntroductionRepository;

  constructor(repository: WeatherIntroductionRepository) {
    this.#repository = repository;
  }

  hasSeenIntroduction = (): boolean => this.#repository.hasSeenIntroduction();
  markIntroductionSeen = (): void => {
    this.#repository.markIntroductionSeen();
  };
}
