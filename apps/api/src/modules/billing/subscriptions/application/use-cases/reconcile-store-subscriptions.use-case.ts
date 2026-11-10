import { uniq } from "es-toolkit";

import type { UnitOfWorkPort } from "#api/shared/application/ports/index";

import type { SubscriptionUserMutationLockPort } from "../../../premium-grants/application/ports/billing-user-lock.port.js";
import type { SubscriptionCachePort } from "../../../premium-grants/application/ports/premium-access-cache.port.js";
import type { PremiumAccessProjector } from "../../../premium-grants/application/use-cases/project-premium-access.use-case.js";
import type { SubscriptionReconcileField } from "../../domain/subscription.aggregate.js";
import type { StoreSubscriptionStatusReaderPort } from "../ports/store-subscription-status.reader.port.js";
import type { SubscriptionRepositoryPort } from "../ports/subscription.repository.port.js";

export interface ReconcileStoreSubscriptionsInput {
  readonly userId: string;
  readonly now: Date;
}

export interface ReconcileStoreSubscriptionsResult {
  /** 스토어 상태와 달라 고친 체인 수 */
  readonly correctedCount: number;
  readonly fields: readonly SubscriptionReconcileField[];
}

interface ReconcileStoreSubscriptionsDependencies {
  readonly subscriptionRepository: Pick<
    SubscriptionRepositoryPort,
    "findReconcilableByUserId" | "updateStatus"
  >;
  readonly statusReader: StoreSubscriptionStatusReaderPort;
  readonly userMutationLock: SubscriptionUserMutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly premiumAccessProjector: Pick<PremiumAccessProjector, "project">;
  readonly cache: SubscriptionCachePort;
}

const UNCHANGED: ReconcileStoreSubscriptionsResult = { correctedCount: 0, fields: [] };

/**
 * 웹훅은 신호로 보고 스토어 상태를 다시 읽어 사용자의 체인 행을 맞춘다. 스토어 읽기는 트랜잭션 밖에서 하고,
 * 실패하면 아무것도 바꾸지 않고 던져 잡이 다시 시도한다. 고친 것이 있을 때만 프리미엄을 다시 계산한다.
 * 결과 로그는 잡 처리기가 요약 한 건으로 남긴다.
 */
export class ReconcileStoreSubscriptions {
  readonly #dependencies: ReconcileStoreSubscriptionsDependencies;

  constructor(dependencies: ReconcileStoreSubscriptionsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute({
    userId,
    now,
  }: ReconcileStoreSubscriptionsInput): Promise<ReconcileStoreSubscriptionsResult> {
    const { subscriptionRepository, statusReader } = this.#dependencies;
    const candidates = await subscriptionRepository.findReconcilableByUserId(userId);
    const states =
      candidates.length === 0
        ? []
        : await statusReader.read(
            candidates.map((subscription) => subscription.storeSubscriptionId.value),
          );
    if (states == null || states.length === 0) {
      return UNCHANGED;
    }
    const stateByChain = new Map(states.map((state) => [state.storeSubscriptionId, state]));

    const corrections = await this.#dependencies.unitOfWork.run(async () => {
      if (!(await this.#dependencies.userMutationLock.lockById(userId))) {
        return [];
      }
      // 읽는 동안 처리된 웹훅이 있을 수 있어 잠근 뒤 행을 다시 읽는다
      const subscriptions = await subscriptionRepository.findReconcilableByUserId(userId);
      const corrected: SubscriptionReconcileField[][] = [];
      for (const subscription of subscriptions) {
        const state = stateByChain.get(subscription.storeSubscriptionId.value);
        const fields = state == null ? [] : subscription.reconcileWithStore(state, now);
        if (fields.length === 0) {
          continue;
        }
        await subscriptionRepository.updateStatus(
          subscription.storeSubscriptionId,
          subscription.persistenceState,
        );
        corrected.push(fields);
      }
      if (corrected.length > 0) {
        await this.#dependencies.premiumAccessProjector.project({ userId, now });
      }
      return corrected;
    });

    if (corrections.length === 0) {
      return UNCHANGED;
    }
    await this.#dependencies.cache.invalidate(userId);
    return { correctedCount: corrections.length, fields: uniq(corrections.flat()) };
  }
}
