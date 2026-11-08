import type { CoachmarkInput } from '../domains/coachmark.model';
import type { CoachmarkRepository } from './coachmark.repository';

export class CoachmarkService {
  readonly #repository: Pick<CoachmarkRepository, 'hasSeen' | 'markSeen'>;
  readonly #listeners = new Set<() => void>();

  constructor(repository: Pick<CoachmarkRepository, 'hasSeen' | 'markSeen'>) {
    this.#repository = repository;
  }

  claim = (input: CoachmarkInput): boolean => {
    if (this.#repository.hasSeen(input)) {
      return false;
    }
    this.#repository.markSeen(input);
    return true;
  };

  isPending = (input: CoachmarkInput): boolean => !this.#repository.hasSeen(input);

  complete = (input: CoachmarkInput): void => {
    if (this.#repository.hasSeen(input)) {
      return;
    }
    this.#repository.markSeen(input);
    this.#listeners.forEach((listener) => listener());
  };

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };
}
