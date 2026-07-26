import { StoreReviewPromptPolicy } from '../models/store-review-prompt.policy';
import type { StoreReviewPromptRepository } from '../repositories/store-review-prompt.repository';

export type StoreReviewDecision = 'dismiss' | 'review';

export interface StoreReviewGateway {
  isAvailable(): Promise<boolean>;
  requestReview(): Promise<void>;
}

interface SuccessfulCompletionInput {
  accountId: string;
  todoId: number;
  localDate: string;
}

export class StoreReviewPromptService {
  readonly #repository: StoreReviewPromptRepository;
  readonly #gateway: StoreReviewGateway;
  readonly #now: () => Date;
  readonly #inFlightAccounts = new Set<string>();

  constructor(
    repository: StoreReviewPromptRepository,
    gateway: StoreReviewGateway,
    now: () => Date = () => new Date(),
  ) {
    this.#repository = repository;
    this.#gateway = gateway;
    this.#now = now;
  }

  async recordSuccessfulCompletion(
    { accountId, todoId, localDate }: SuccessfulCompletionInput,
    decide: () => Promise<StoreReviewDecision>,
  ): Promise<boolean> {
    const state = this.#repository.recordSuccessfulCompletion(accountId, {
      todoId,
      localDate,
    });
    const now = this.#now();

    if (
      this.#inFlightAccounts.has(accountId) ||
      !StoreReviewPromptPolicy.shouldPrompt(state, now)
    ) {
      return false;
    }
    this.#inFlightAccounts.add(accountId);
    try {
      if (!(await this.#gateway.isAvailable())) {
        return false;
      }

      const decision = await decide();
      if (decision === 'dismiss') {
        this.#repository.recordDismissal(accountId, now);
        return true;
      }

      // OS가 실제 프롬프트를 표시하는지는 플랫폼 정책에 달려 있다. 중복 요청 방지를 위해
      // 네이티브 API 호출 전에 사용자의 명시적 선택을 기록한다.
      this.#repository.recordReviewRequested(accountId, now);
      await this.#gateway.requestReview();
      return true;
    } finally {
      this.#inFlightAccounts.delete(accountId);
    }
  }
}
