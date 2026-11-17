import type { UserMutationLockPort } from "#api/modules/identity/users/identity-users.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { StoreCustomerId } from "../../domain/store-customer-id.vo.js";
import { StoreSubscriptionId } from "../../domain/store-subscription-id.vo.js";
import {
  providerEventIdOf,
  type StoreSubscriptionChainEvent,
} from "../../domain/store-subscription.event.js";
import { SubscriptionEventReceipt } from "../../domain/subscription-event-receipt.entity.js";
import type { Subscription } from "../../domain/subscription.aggregate.js";
import type { StoreSubscriptionReconcileSchedulerPort } from "../ports/store-subscription-reconcile-scheduler.port.js";
import type { SubscriptionEventNotifierPort } from "../ports/subscription-event-notifier.port.js";
import type { SubscriptionEventReceiptRepositoryPort } from "../ports/subscription-event-receipt.repository.port.js";
import type { SubscriptionUserReaderPort } from "../ports/subscription-user.reader.port.js";
import type { SubscriptionRepositoryPort } from "../ports/subscription.repository.port.js";
import type { SubscriptionEventOutcomeReadModel } from "../read-models/subscription-event-outcome.read-model.js";
import type { SubscriptionUserReadModel } from "../read-models/subscription-user.read-model.js";
import {
  isPermanentWebhookFailure,
  subscriptionUserNotFound,
  subscriptionWebhookLockContended,
} from "../subscriptions.errors.js";
import { SubscriptionLockKeys } from "../subscriptions.lock-keys.js";
import { SubscriptionLogEvent } from "../subscriptions.log-events.js";
import type { ChangeSubscriptionChainUseCase } from "./change-subscription-chain.use-case.js";

export type ApplySubscriptionChainEventCommand = Exclude<
  StoreSubscriptionChainEvent,
  { kind: "IGNORED" }
>;

export interface ApplySubscriptionChainEventDependencies {
  readonly subscriptionRepository: Pick<SubscriptionRepositoryPort, "findByStoreSubscriptionId">;
  readonly subscriptionUserReader: Pick<SubscriptionUserReaderPort, "findFirstByStoreCustomerIds">;
  readonly receiptRepository: SubscriptionEventReceiptRepositoryPort;
  readonly userLock: Pick<UserMutationLockPort, "lockById">;
  readonly mutationLock: Pick<MutationLockPort, "tryAcquire">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly changeSubscriptionChain: Pick<ChangeSubscriptionChainUseCase, "execute">;
  readonly notifier: Pick<SubscriptionEventNotifierPort, "recordBillingIssue">;
  readonly reconcileScheduler: StoreSubscriptionReconcileSchedulerPort;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

/**
 * 한 구독 체인에 온 이벤트를 한 트랜잭션에서 반영한다. 웹훅 잠금 → 사용자 잠금 → 처리 원장 → 상태 대조 예약
 * 순서로 잡고, 체인 행 변경과 프리미엄 계산은 ChangeSubscriptionChain이 한다.
 */
export class ApplySubscriptionChainEventUseCase {
  readonly #dependencies: ApplySubscriptionChainEventDependencies;

  constructor(dependencies: ApplySubscriptionChainEventDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    event: ApplySubscriptionChainEventCommand,
  ): Promise<SubscriptionEventOutcomeReadModel> {
    const user = await this.#dependencies.subscriptionUserReader.findFirstByStoreCustomerIds([
      StoreCustomerId.reconstitute(event.appUserId),
    ]);
    if (user == null) {
      throw subscriptionUserNotFound(event.appUserId);
    }
    try {
      return await this.#applyInTransaction(user, event);
    } catch (error) {
      if (isPermanentWebhookFailure(error)) {
        await this.#scheduleRecovery(user.id);
      }
      throw error;
    }
  }

  async #applyInTransaction(
    user: SubscriptionUserReadModel,
    event: ApplySubscriptionChainEventCommand,
  ): Promise<SubscriptionEventOutcomeReadModel> {
    const { userLock, reconcileScheduler, changeSubscriptionChain, notifier, clock } =
      this.#dependencies;
    return this.#dependencies.unitOfWork.run(async () => {
      await this.#lockWebhook(event.appUserId);
      if (!(await userLock.lockById(user.id))) {
        throw subscriptionUserNotFound(event.appUserId);
      }
      // 처리 원장은 업무 변경과 함께 커밋한다. 실패한 트랜잭션은 다시 처리할 수 있다
      if (!(await this.#claimReceipt(event))) {
        return { status: "duplicate", userId: user.id };
      }
      // 이벤트는 신호다. 늦거나 빠진 이벤트로 어긋난 상태를 스토어에서 다시 읽어 맞추도록 함께 커밋한다
      await reconcileScheduler.schedule(user.id, clock.now());
      const subscription = await this.#findSubscription(event);
      // 배포 이전 마지막 이벤트 ID도 중복 처리하지 않는다
      const eventId = providerEventIdOf(event);
      if (eventId != null && subscription?.isAlreadyProcessed(eventId) === true) {
        return { status: "unchanged", userId: user.id };
      }
      const payload = await changeSubscriptionChain.execute({ user, event, subscription });
      if (payload == null) {
        return { status: "unchanged", userId: user.id };
      }
      if (event.kind === "BILLING_ISSUE") {
        await notifier.recordBillingIssue(user.id, clock.now());
      }
      return { status: "applied", userId: user.id, affectedUserIds: [user.id], payload };
    });
  }

  // 같은 앱 사용자의 웹훅은 기다리지 않고 429로 돌려 공급자가 다시 보내게 한다. 잠금은 트랜잭션이 끝나면 풀린다
  async #lockWebhook(appUserId: string): Promise<void> {
    const keys = [SubscriptionLockKeys.webhook(appUserId)];
    if (!(await this.#dependencies.mutationLock.tryAcquire(keys))) {
      throw subscriptionWebhookLockContended(appUserId);
    }
  }

  async #claimReceipt(event: ApplySubscriptionChainEventCommand): Promise<boolean> {
    const eventId = providerEventIdOf(event);
    if (eventId == null) {
      return true;
    }
    return this.#dependencies.receiptRepository.claim(
      SubscriptionEventReceipt.create({
        provider: event.provider,
        eventId,
        eventType: event.providerEventType,
        environment: event.environment,
        now: this.#dependencies.clock.now(),
      }),
    );
  }

  async #findSubscription(event: ApplySubscriptionChainEventCommand): Promise<Subscription | null> {
    if (event.storeSubscriptionId == null || event.storeSubscriptionId === "") {
      return null;
    }
    return this.#dependencies.subscriptionRepository.findByStoreSubscriptionId(
      StoreSubscriptionId.create(event.storeSubscriptionId),
    );
  }

  // 영구 실패는 공급자가 다시 보내지 않으므로 스토어 상태를 다시 읽어 스스로 맞춘다
  async #scheduleRecovery(userId: UserId): Promise<void> {
    try {
      await this.#dependencies.reconcileScheduler.schedule(userId, this.#dependencies.clock.now());
    } catch (error) {
      this.#dependencies.logger.warn({
        event: SubscriptionLogEvent.RECONCILE_FAILED,
        userId: userId.value,
        errorType: toErrorType(error),
      });
    }
  }
}
