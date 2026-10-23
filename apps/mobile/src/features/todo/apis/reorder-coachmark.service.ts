import type {
  ClaimReorderCoachmarkInput,
  ReorderCoachmarkRepository,
} from './reorder-coachmark.repository';

export class ReorderCoachmarkService {
  readonly #repository: ReorderCoachmarkRepository;

  constructor(repository: ReorderCoachmarkRepository) {
    this.#repository = repository;
  }

  claim = (input: ClaimReorderCoachmarkInput): boolean => this.#repository.claim(input);
}
