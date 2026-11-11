import type { CoachmarkInput } from '../domains/coachmark.model';
import type { CoachmarkRepository } from './coachmark.repository';

// 보이면 끝나는 안내는 claim, 쓰거나 닫아야 끝나는 안내는 isPending·complete(구독 화면도 바로 닫힌다)를 쓴다
export class CoachmarkService {
  readonly #repository: Pick<CoachmarkRepository, 'hasSeen' | 'markSeen' | 'removeRetiredKeys'>;
  readonly #listeners = new Set<() => void>();

  constructor(repository: Pick<CoachmarkRepository, 'hasSeen' | 'markSeen' | 'removeRetiredKeys'>) {
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

  removeRetiredKeys = (): void => {
    this.#repository.removeRetiredKeys();
  };

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };
}
