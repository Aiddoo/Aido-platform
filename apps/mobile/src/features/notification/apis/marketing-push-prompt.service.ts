import type { MarketingPushPromptState } from '../schemas/marketing-push-prompt.schema';
import type { MarketingPushPromptRepository } from './marketing-push-prompt.repository';

export class MarketingPushPromptService {
  readonly #repository: MarketingPushPromptRepository;

  constructor(repository: MarketingPushPromptRepository) {
    this.#repository = repository;
  }

  getState = (): MarketingPushPromptState => this.#repository.get();

  recordPrompt = (promptedAt: Date): void => {
    this.#repository.record(promptedAt);
  };
}
