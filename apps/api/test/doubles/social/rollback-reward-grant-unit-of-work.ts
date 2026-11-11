import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import type { InMemoryRewardGrantRepository } from "./in-memory-reward-grant.repository.js";

// 실패하면 지급 원장을 시작 전으로 되돌려 트랜잭션 rollback을 흉내 낸다(적용 펜싱이 함께 풀리는지 본다)
export class RollbackRewardGrantUnitOfWork extends UnitOfWorkPort {
  readonly #rewardGrantRepository: InMemoryRewardGrantRepository;

  constructor(rewardGrantRepository: InMemoryRewardGrantRepository) {
    super();
    this.#rewardGrantRepository = rewardGrantRepository;
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    const state = this.#rewardGrantRepository.captureState();
    try {
      return await work();
    } catch (error) {
      this.#rewardGrantRepository.restoreState(state);
      throw error;
    }
  }
}
