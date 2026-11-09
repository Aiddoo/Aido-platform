import { uniq } from "es-toolkit";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";

import type { SubscriptionReconcileField } from "../../../domain/aggregates/subscriptions/subscription.aggregate.js";
import { BillingLogEvent } from "../../observability/subscriptions/billing-log.events.js";
import type { StoreSubscriptionStatusReaderPort } from "../../ports/subscriptions/store-subscription-status.reader.port.js";
import type { SubscriptionCachePort } from "../../ports/subscriptions/subscription-cache.port.js";
import type { SubscriptionUserMutationLockPort } from "../../ports/subscriptions/subscription-user-mutation-lock.port.js";
import type { SubscriptionRepositoryPort } from "../../ports/subscriptions/subscription.repository.port.js";
import type { PremiumAccessProjector } from "../../services/subscriptions/premium-access-projector.service.js";

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
  readonly logger: Pick<ApplicationLogger, "log">;
}

const UNCHANGED: ReconcileStoreSubscriptionsResult = { correctedCount: 0, fields: [] };

/**
 * 웹훅은 신호로 보고 스토어 상태를 다시 읽어 사용자의 체인 행을 맞춘다. 스토어 읽기는 트랜잭션 밖에서 하고,
 * 실패하면 아무것도 바꾸지 않고 던져 잡이 다시 시도한다. 고친 것이 있을 때만 프리미엄을 다시 계산한다.
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
        : await statusReader.read(candidates.map((subscription) => subscription.revenueCatId));
    if (states == null || states.length === 0) {
      this.#logUnchanged(userId);
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
        const state = stateByChain.get(subscription.revenueCatId);
        const fields = state == null ? [] : subscription.reconcileWithStore(state, now);
        if (fields.length === 0) {
          continue;
        }
        await subscriptionRepository.updateStatus(
          subscription.revenueCatId,
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
      this.#logUnchanged(userId);
      return UNCHANGED;
    }
    await this.#dependencies.cache.invalidate(userId);
    const result = { correctedCount: corrections.length, fields: uniq(corrections.flat()) };
    this.#dependencies.logger.log({
      event: BillingLogEvent.RECONCILE_CORRECTED,
      userId,
      ...result,
    });
    return result;
  }

  #logUnchanged(userId: string): void {
    this.#dependencies.logger.log({ event: BillingLogEvent.RECONCILE_UNCHANGED, userId });
  }
}
