import { uniq } from "es-toolkit";

import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { BillingUserLockPort } from "../../../premium-grants/application/ports/billing-user-lock.port.js";
import type { PremiumAccessCachePort } from "../../../premium-grants/application/ports/premium-access-cache.port.js";
import type { ProjectPremiumAccessUseCase } from "../../../premium-grants/application/use-cases/project-premium-access.use-case.js";
import type { SubscriptionReconcileField } from "../../domain/subscription.aggregate.js";
import type { StoreSubscriptionStatusReaderPort } from "../ports/store-subscription-status.reader.port.js";
import type { SubscriptionRepositoryPort } from "../ports/subscription.repository.port.js";

export interface ReconcileStoreSubscriptionsCommand {
  readonly userId: string;
  readonly now: Temporal.Instant;
}

export interface ReconcileStoreSubscriptionsResult {
  /** 스토어 상태와 달라 고친 체인 수 */
  readonly correctedCount: number;
  readonly fields: readonly SubscriptionReconcileField[];
}

export interface ReconcileStoreSubscriptionsDependencies {
  readonly subscriptionRepository: Pick<
    SubscriptionRepositoryPort,
    "listReconcilableByUserId" | "save"
  >;
  readonly statusReader: StoreSubscriptionStatusReaderPort;
  readonly userLock: BillingUserLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly projectPremiumAccess: Pick<ProjectPremiumAccessUseCase, "execute">;
  readonly cache: PremiumAccessCachePort;
}

const UNCHANGED: ReconcileStoreSubscriptionsResult = { correctedCount: 0, fields: [] };

/**
 * 웹훅은 신호로 보고 스토어 상태를 다시 읽어 사용자의 체인 행을 맞춘다. 스토어 읽기는 트랜잭션 밖에서 하고,
 * 실패하면 아무것도 바꾸지 않고 던져 잡이 다시 시도한다. 고친 것이 있을 때만 프리미엄을 다시 계산한다.
 * 결과 로그는 잡 처리기가 요약 한 건으로 남긴다.
 */
export class ReconcileStoreSubscriptionsUseCase {
  readonly #dependencies: ReconcileStoreSubscriptionsDependencies;

  constructor(dependencies: ReconcileStoreSubscriptionsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    command: ReconcileStoreSubscriptionsCommand,
  ): Promise<ReconcileStoreSubscriptionsResult> {
    const { subscriptionRepository, statusReader } = this.#dependencies;
    const { now } = command;
    const userId = UserId.reconstitute(command.userId);
    const candidates = await subscriptionRepository.listReconcilableByUserId(userId);
    const states =
      candidates.length === 0
        ? []
        : await statusReader.read(
            candidates.map((subscription) => subscription.storeSubscriptionId),
          );
    if (states == null || states.length === 0) {
      return UNCHANGED;
    }
    const stateByChain = new Map(states.map((state) => [state.storeSubscriptionId, state]));

    const corrections = await this.#dependencies.unitOfWork.run(async () => {
      if (!(await this.#dependencies.userLock.lockById(userId))) {
        return [];
      }
      // 읽는 동안 처리된 웹훅이 있을 수 있어 잠근 뒤 행을 다시 읽는다
      const subscriptions = await subscriptionRepository.listReconcilableByUserId(userId);
      const corrected: SubscriptionReconcileField[][] = [];
      for (const subscription of subscriptions) {
        const state = stateByChain.get(subscription.storeSubscriptionId.value);
        const fields = state == null ? [] : subscription.reconcileWithStore(state, now);
        if (fields.length === 0) {
          continue;
        }
        await subscriptionRepository.save(subscription);
        corrected.push(fields);
      }
      if (corrected.length > 0) {
        await this.#dependencies.projectPremiumAccess.execute({ userId, now });
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
