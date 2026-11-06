import type { CoachmarkInput, CoachmarkRepository } from './coachmark.repository';

/**
 * 계정당 한 번만 보이는 안내 줄. 보이는 순간 끝나는 안내는 claim, 쓰거나 닫아야 끝나는 안내는 isPending·complete를 쓴다.
 * complete는 구독자에게 알려 같은 안내를 보이는 화면이 바로 닫힌다.
 */
export class CoachmarkService {
  readonly #repository: Pick<CoachmarkRepository, 'isSeen' | 'markSeen'>;
  readonly #listeners = new Set<() => void>();

  constructor(repository: Pick<CoachmarkRepository, 'isSeen' | 'markSeen'>) {
    this.#repository = repository;
  }

  claim = (input: CoachmarkInput): boolean => {
    if (this.#repository.isSeen(input)) {
      return false;
    }
    this.#repository.markSeen(input);
    return true;
  };

  isPending = (input: CoachmarkInput): boolean => !this.#repository.isSeen(input);

  complete = (input: CoachmarkInput): void => {
    if (this.#repository.isSeen(input)) {
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
