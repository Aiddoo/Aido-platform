import { ErrorCode } from "@aido/api/errors";
import { sortBy, uniq, uniqBy } from "es-toolkit";
import { match } from "ts-pattern";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { now } from "#api/shared/domain/date/utils/core";
import { toISOString } from "#api/shared/domain/date/utils/format";
import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";

import type { SubscriptionUserMutationLockPort } from "../../../premium-grants/application/ports/billing-user-lock.port.js";
import type { SubscriptionCachePort } from "../../../premium-grants/application/ports/premium-access-cache.port.js";
import type { PremiumAccessProjector } from "../../../premium-grants/application/use-cases/project-premium-access.use-case.js";
import type {
  PremiumAccess,
  StoreEventChainState,
} from "../../../shared/premium-access.domain-service.js";
import { resolveCancellationUserStatus } from "../../domain/cancellation-user-status.domain-service.js";
import { StoreSubscriptionId } from "../../domain/store-subscription-id.vo.js";
import type {
  StoreSubscriptionChainEvent,
  StoreSubscriptionEvent,
  SubscriptionBillingIssueEvent,
  SubscriptionRenewedEvent,
  SubscriptionStartedEvent,
  SubscriptionTransferredEvent,
} from "../../domain/store-subscription.event.js";
import type { Subscription } from "../../domain/subscription.aggregate.js";
import type { StoreSubscriptionReconcileSchedulerPort } from "../ports/store-subscription-reconcile-scheduler.port.js";
import type {
  StoreSubscriptionEventFailureContext,
  SubscriptionEventNotifierPort,
} from "../ports/subscription-event-notifier.port.js";
import type { SubscriptionEventReceiptRepositoryPort } from "../ports/subscription-event-receipt.repository.port.js";
import type { SubscriptionWebhookLockPort } from "../ports/subscription-webhook-lock.port.js";
import type {
  SubscriptionRepositoryPort,
  SubscriptionUser,
  UpdateUserSubscriptionStatusData,
} from "../ports/subscription.repository.port.js";
import type { SubscriptionEventPayload } from "../read-models/subscription-event-payload.read-model.js";
import {
  baseEventPayload,
  periodTypeAfter,
  premiumSnapshotOf,
  transferEventPayload,
} from "../subscription-event-payload.mapper.js";
import { BillingLogEvent } from "../subscriptions.log-events.js";

type ProcessedChainEvent = Exclude<StoreSubscriptionChainEvent, { kind: "IGNORED" }>;

interface ApplyStoreSubscriptionEventDependencies {
  readonly subscriptionRepository: SubscriptionRepositoryPort;
  readonly receiptRepository: SubscriptionEventReceiptRepositoryPort;
  readonly userMutationLock: SubscriptionUserMutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly cache: SubscriptionCachePort;
  readonly notifier: SubscriptionEventNotifierPort;
  readonly webhookLock: SubscriptionWebhookLockPort;
  readonly premiumAccessProjector: Pick<PremiumAccessProjector, "project">;
  readonly reconcileScheduler: StoreSubscriptionReconcileSchedulerPort;
  readonly logger: ApplicationLoggerPort;
}

interface SubscriptionTransition {
  readonly userState: UpdateUserSubscriptionStatusData;
  readonly payload: SubscriptionEventPayload;
  /** 이벤트가 행과 다른 만료 시각을 알려 주면 보상 기간 판단에 그 값을 쓴다. 비우면 행의 값이다. */
  readonly chainExpiresAt?: Date;
}

/**
 * 보상 기간 판단에 넘길 체인 상태는 이벤트를 적용한 행 그대로다. 만료는 행을 지우지 않고 스토어가 끝난 시각을
 * 남겨 쌓아 둔 보상이 이벤트 도착 시각이 아니라 그 시각부터 이어지게 한다.
 */
function chainStateOf(
  subscription: Subscription,
): Omit<StoreEventChainState, "storeSubscriptionId"> {
  return {
    status: subscription.status,
    expiresAt: subscription.expiresAt,
    gracePeriodEndsAt: subscription.gracePeriodEndsAt,
    periodType: subscription.periodType,
  };
}

function withPremium(
  payload: SubscriptionEventPayload,
  access: PremiumAccess,
): SubscriptionEventPayload {
  return { ...payload, premium: premiumSnapshotOf(access) };
}

/**
 * 다시 보내도 결과가 같아 공급자 재전송이 의미 없는 실패: 사용자·체인·필수 시각이 없는 이벤트다. 그 밖의 실패
 * (DB·외부 호출)는 처리 원장도 함께 롤백되므로 non-2xx로 공급자 재전송에 맡긴다.
 */
const PERMANENT_FAILURE_CODES: ReadonlySet<string> = new Set([
  ErrorCode.SUBSCRIPTION_1602,
  ErrorCode.SUBSCRIPTION_1604,
]);

// 체인 ID가 없는 이벤트는 StoreSubscriptionId(Domain)가 같은 코드로 거절한다
function isPermanentFailure(error: unknown): boolean {
  return error instanceof ErrorCodedException && PERMANENT_FAILURE_CODES.has(error.errorCode);
}

function requireDate(value: Date | undefined, kind: string, reason: string): Date {
  if (value == null) {
    throw new ApplicationException(ErrorCode.SUBSCRIPTION_1604, { reason, eventType: kind });
  }
  return value;
}

function failureContextOf(event: StoreSubscriptionEvent): StoreSubscriptionEventFailureContext {
  return {
    kind: event.kind,
    ...(event.providerEventId != null && { providerEventId: event.providerEventId }),
    ...(event.store != null && { store: event.store }),
    ...(event.environment != null && { environment: event.environment }),
    ...(event.kind !== "TRANSFERRED" && { productId: event.productId }),
  };
}

/** 공급자 번역기가 만든 스토어 구독 이벤트를 구독 행과 프리미엄에 반영한다. */
export class ApplyStoreSubscriptionEvent {
  readonly #dependencies: ApplyStoreSubscriptionEventDependencies;

  constructor(dependencies: ApplyStoreSubscriptionEventDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(event: StoreSubscriptionEvent): Promise<void> {
    // 처리하지 않는 이벤트(대시보드 TEST 등)는 우리 사용자가 아닐 수 있어 사용자를 찾기 전에 닫는다
    if (event.kind === "IGNORED") {
      this.#dependencies.logger.log({
        event: BillingLogEvent.WEBHOOK_IGNORED,
        eventType: event.providerEventType,
        eventId: event.providerEventId,
      });
      return;
    }
    await this.#guard(failureContextOf(event), () =>
      event.kind === "TRANSFERRED" ? this.#processTransfer(event) : this.#process(event),
    );
  }

  // 영구 실패는 보고하고 받은 것으로 닫고, 잠금 경합(429)과 일시 실패(5xx)는 던져 공급자가 다시 보내게 한다
  async #guard(
    context: StoreSubscriptionEventFailureContext,
    run: () => Promise<void>,
  ): Promise<void> {
    try {
      await run();
    } catch (error) {
      if (
        error instanceof ApplicationException &&
        error.errorCode === ErrorCode.SUBSCRIPTION_1605
      ) {
        this.#dependencies.logger.warn({ event: BillingLogEvent.WEBHOOK_LOCK_CONTENDED });
        throw error;
      }
      const isRetryable = !isPermanentFailure(error);
      this.#dependencies.logger.error({
        event: BillingLogEvent.WEBHOOK_FAILED,
        eventKind: context.kind,
        isRetryable,
        errorCode: error instanceof ErrorCodedException ? error.errorCode : undefined,
        errorType: toErrorType(error),
      });
      if (isRetryable) {
        throw error;
      }
      this.#dependencies.notifier.reportWebhookFailure(error, context);
    }
  }

  // 반영은 이미 커밋됐다. 다시 받아도 처리 원장이 막아 효과를 되풀이하지 못하므로 보고하고 받은 것으로 닫는다
  async #settleAfterCommit(
    event: StoreSubscriptionEvent,
    userIds: readonly string[],
  ): Promise<boolean> {
    try {
      await Promise.all(userIds.map((userId) => this.#dependencies.cache.invalidate(userId)));
      return true;
    } catch (error) {
      this.#dependencies.notifier.reportWebhookFailure(error, failureContextOf(event));
      this.#dependencies.logger.error({
        event: BillingLogEvent.WEBHOOK_FAILED,
        eventKind: event.kind,
        isRetryable: false,
        errorType: toErrorType(error),
      });
      return false;
    }
  }

  // 영구 실패는 공급자가 다시 보내지 않으므로 스토어 상태를 다시 읽어 스스로 맞춘다
  async #scheduleRecovery(userId: string): Promise<void> {
    try {
      await this.#dependencies.reconcileScheduler.schedule(userId, now());
    } catch (error) {
      this.#dependencies.logger.warn({
        event: BillingLogEvent.RECONCILE_FAILED,
        userId,
        errorType: toErrorType(error),
      });
    }
  }

  /**
   * 이전: 넘겨받은 사용자에게 넘겨준 사용자의 체인 행을 옮기고 둘 다 다시 계산한다. 이전 이벤트에는 체인 ID가
   * 없어 넘겨준 사용자의 행 전체를 옮기고, 같은 체인의 이벤트가 다시 그 사용자로 오면 claimChain이 되돌린다.
   * 행이 없으면(탈퇴로 지워짐) 다음 갱신이 체인을 이어 받는다.
   */
  async #processTransfer(event: SubscriptionTransferredEvent): Promise<void> {
    const { subscriptionRepository, webhookLock, unitOfWork, userMutationLock } =
      this.#dependencies;
    const receiverAppUserIds = uniq(event.receivers);
    const lockKey = receiverAppUserIds[0] ?? "";
    this.#logStarted(event);
    const release = await webhookLock.acquire(lockKey);
    if (release == null) {
      throw new ApplicationException(ErrorCode.SUBSCRIPTION_1605, { appUserId: lockKey });
    }

    try {
      const receiver = await this.#findFirstUser(receiverAppUserIds);
      if (receiver == null) {
        throw new ApplicationException(ErrorCode.SUBSCRIPTION_1602, { appUserId: lockKey });
      }
      const previousOwners = uniqBy(
        (
          await Promise.all(
            uniq(event.transferredFrom).map((appUserId) =>
              subscriptionRepository.findUserByAppUserId(appUserId),
            ),
          )
        ).flatMap((owner) => (owner == null || owner.id === receiver.id ? [] : [owner])),
        (owner) => owner.id,
      );
      const result = await unitOfWork.run(async () => {
        // 넘겨준·넘겨받은 사용자를 id 순으로 잠가 반대 방향 이전과 교착하지 않는다
        for (const user of sortBy([receiver, ...previousOwners], [(user) => user.id])) {
          if (!(await userMutationLock.lockById(user.id)) && user.id === receiver.id) {
            throw new ApplicationException(ErrorCode.SUBSCRIPTION_1602, { appUserId: lockKey });
          }
        }
        if (!(await this.#claimReceipt(event))) {
          return null;
        }
        for (const owner of previousOwners) {
          await subscriptionRepository.takeOverChains(owner.id, receiver.id);
        }
        const at = now();
        // 옮겨 받은 스토어 행과 보상 기간을 함께 보고 다시 계산해 보상 기간이 구독을 덮지 않게 한다
        const { access } = await this.#dependencies.premiumAccessProjector.project({
          userId: receiver.id,
          now: at,
        });
        for (const owner of previousOwners) {
          await this.#dependencies.premiumAccessProjector.project({ userId: owner.id, now: at });
        }
        return withPremium(transferEventPayload(receiver, event, lockKey), access);
      });

      if (result == null) {
        this.#logDuplicate(event, receiver.id);
        return;
      }
      if (
        !(await this.#settleAfterCommit(
          event,
          [receiver, ...previousOwners].map((user) => user.id),
        ))
      ) {
        return;
      }
      this.#dependencies.notifier.notifySubscriptionEvent(result);
      this.#logCompleted(event, receiver.id);
    } finally {
      await release();
    }
  }

  async #findFirstUser(appUserIds: readonly string[]): Promise<SubscriptionUser | null> {
    for (const appUserId of appUserIds) {
      const user = await this.#dependencies.subscriptionRepository.findUserByAppUserId(appUserId);
      if (user != null) {
        return user;
      }
    }
    return null;
  }

  async #process(event: ProcessedChainEvent): Promise<void> {
    const { subscriptionRepository, webhookLock } = this.#dependencies;
    this.#logStarted(event);
    const release = await webhookLock.acquire(event.appUserId);
    if (release == null) {
      throw new ApplicationException(ErrorCode.SUBSCRIPTION_1605, { appUserId: event.appUserId });
    }

    try {
      const user = await subscriptionRepository.findUserByAppUserId(event.appUserId);
      if (user == null) {
        throw new ApplicationException(ErrorCode.SUBSCRIPTION_1602, {
          appUserId: event.appUserId,
        });
      }
      const eventPayload = await this.#applyInTransaction(user, event).catch(
        async (error: unknown) => {
          if (isPermanentFailure(error)) {
            await this.#scheduleRecovery(user.id);
          }
          throw error;
        },
      );

      if (eventPayload == null) {
        this.#dependencies.logger.debug({
          event: BillingLogEvent.WEBHOOK_NO_CHANGE,
          eventKind: event.kind,
          userId: user.id,
        });
        return;
      }
      if (!(await this.#settleAfterCommit(event, [user.id]))) {
        return;
      }
      this.#dependencies.notifier.notifySubscriptionEvent(eventPayload);
      this.#logCompleted(event, user.id);
    } finally {
      await release();
    }
  }

  async #applyInTransaction(
    user: SubscriptionUser,
    event: ProcessedChainEvent,
  ): Promise<SubscriptionEventPayload | null> {
    const { subscriptionRepository, userMutationLock } = this.#dependencies;
    return this.#dependencies.unitOfWork.run(async () => {
      if (!(await userMutationLock.lockById(user.id))) {
        throw new ApplicationException(ErrorCode.SUBSCRIPTION_1602, {
          appUserId: event.appUserId,
        });
      }
      // 처리 원장은 업무 변경과 함께 커밋한다. 실패한 트랜잭션은 다시 처리할 수 있다
      if (!(await this.#claimReceipt(event))) {
        this.#logDuplicate(event, user.id);
        return null;
      }
      // 이벤트는 신호다. 늦거나 빠진 이벤트로 어긋난 상태를 스토어에서 다시 읽어 맞추도록 함께 커밋한다
      await this.#dependencies.reconcileScheduler.schedule(user.id, now());
      const subscription =
        event.storeSubscriptionId != null && event.storeSubscriptionId !== ""
          ? await subscriptionRepository.findByStoreSubscriptionId(
              StoreSubscriptionId.from(event.storeSubscriptionId),
            )
          : null;
      // 배포 이전 마지막 이벤트 ID도 중복 처리하지 않는다
      if (event.providerEventId != null && subscription?.wasProcessedWith(event.providerEventId)) {
        return null;
      }
      const payload = await this.#applyEvent(user, event, subscription);
      if (payload != null && event.kind === "BILLING_ISSUE") {
        await this.#dependencies.notifier.recordBillingIssue(user.id, now());
      }
      return payload;
    });
  }

  async #claimReceipt(event: StoreSubscriptionEvent): Promise<boolean> {
    if (event.providerEventId == null) {
      return true;
    }
    return this.#dependencies.receiptRepository.claim({
      eventId: event.providerEventId,
      eventType: event.providerEventType,
      processedAt: now(),
      environment: event.environment,
    });
  }

  async #applyEvent(
    user: SubscriptionUser,
    event: ProcessedChainEvent,
    subscription: Subscription | null,
  ): Promise<SubscriptionEventPayload | null> {
    const { subscriptionRepository } = this.#dependencies;
    const storeSubscriptionId = StoreSubscriptionId.from(event.storeSubscriptionId);
    if (event.kind === "BILLING_ISSUE") {
      return this.#enterBillingGrace(user, event, storeSubscriptionId, subscription);
    }
    if (event.kind === "STARTED") {
      return this.#createSubscription(user, event, storeSubscriptionId, subscription);
    }

    // 갱신이 요구하는 시각 오류는 구독 없음 오류보다 우선한다
    const renewalExpiresAt =
      event.kind === "RENEWED"
        ? requireDate(event.periodEndsAt, event.kind, "Missing period end for renewal")
        : undefined;
    if (subscription == null && event.kind === "RENEWED" && renewalExpiresAt != null) {
      return this.#adoptRenewedChain(user, event, storeSubscriptionId, renewalExpiresAt);
    }
    if (subscription == null) {
      throw new ApplicationException(
        ErrorCode.SUBSCRIPTION_1604,
        event.kind === "RENEWED"
          ? {
              reason: `Subscription not found for renewal: ${storeSubscriptionId.value}`,
              eventType: event.kind,
            }
          : { reason: `Subscription not found: ${storeSubscriptionId.value}` },
      );
    }

    // 체인의 이벤트가 다른 사용자로 오면 구매가 옮겨 간 것이다. 행의 소유자를 이벤트 사용자로 맞춰
    // 프리미엄 판단이 User projection 대신 행 자체를 믿을 수 있게 한다
    await subscriptionRepository.claimChain(storeSubscriptionId, user.id);
    const transition = this.#planTransition(
      user,
      event,
      storeSubscriptionId,
      subscription,
      renewalExpiresAt,
    );
    if (transition == null) {
      return null;
    }
    await subscriptionRepository.updateStatus(storeSubscriptionId, subscription.persistenceState);
    const access = await this.#projectUser(user.id, storeSubscriptionId, transition.userState, {
      ...chainStateOf(subscription),
      ...(transition.chainExpiresAt != null && { expiresAt: transition.chainExpiresAt }),
    });
    return withPremium(transition.payload, access);
  }

  /**
   * 결제 실패. 스토어가 결제를 다시 시도하는 결제 유예 동안 엔타이틀먼트가 남으므로 그 끝을 행에 남겨
   * 프리미엄과 쌓아 둔 보상의 시작을 미룬다. 행이 없으면 알림만 보낸다.
   */
  async #enterBillingGrace(
    user: SubscriptionUser,
    event: SubscriptionBillingIssueEvent,
    storeSubscriptionId: StoreSubscriptionId,
    subscription: Subscription | null,
  ): Promise<SubscriptionEventPayload> {
    const payload = baseEventPayload(user, event, storeSubscriptionId.value);
    if (
      subscription == null ||
      !subscription.enterBillingGrace({
        gracePeriodEndsAt: event.gracePeriodEndsAt,
        periodExpiresAt: event.periodEndsAt ?? null,
        eventId: event.providerEventId,
      })
    ) {
      return payload;
    }
    const { subscriptionRepository } = this.#dependencies;
    await subscriptionRepository.claimChain(storeSubscriptionId, user.id);
    await subscriptionRepository.updateStatus(storeSubscriptionId, subscription.persistenceState);
    const access = await this.#projectUser(
      user.id,
      storeSubscriptionId,
      { subscriptionStatus: "ACTIVE", subscriptionExpiresAt: subscription.expiresAt },
      chainStateOf(subscription),
    );
    return withPremium(payload, access);
  }

  /**
   * 행이 없는 체인의 갱신. 탈퇴로 행이 함께 지워진 계정의 구매를 새 계정이 복원하면 이전으로 옮길 행이 없고,
   * 이전 이벤트에는 상품·만료 시각이 없다. 갱신 이벤트로 체인 행을 만들어 이어 받는다.
   */
  async #adoptRenewedChain(
    user: SubscriptionUser,
    event: SubscriptionRenewedEvent,
    storeSubscriptionId: StoreSubscriptionId,
    expiresAt: Date,
  ): Promise<SubscriptionEventPayload> {
    const startedAt = event.startedAt ?? now();
    await this.#dependencies.subscriptionRepository.create({
      userId: user.id,
      storeSubscriptionId,
      productId: event.productId,
      status: "ACTIVE",
      startedAt,
      expiresAt,
      ...(event.providerEventId != null && { lastProcessedEventId: event.providerEventId }),
      environment: event.environment,
      periodType: periodTypeAfter(event) ?? null,
    });
    this.#dependencies.logger.log({
      event: BillingLogEvent.SUBSCRIPTION_CHAIN_ADOPTED,
      eventKind: event.kind,
      userId: user.id,
    });
    const access = await this.#projectUser(user.id, storeSubscriptionId, {
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: expiresAt,
    });
    return withPremium(
      {
        ...baseEventPayload(user, event, storeSubscriptionId.value),
        expiresAt: toISOString(expiresAt),
      },
      access,
    );
  }

  // 스토어 상태가 바뀌면 보상 기간을 함께 보고 User의 구독 projection을 다시 계산한다
  async #projectUser(
    userId: string,
    eventChainId: StoreSubscriptionId,
    requested: UpdateUserSubscriptionStatusData,
    chainState: Omit<StoreEventChainState, "storeSubscriptionId"> = {
      status: requested.subscriptionStatus,
      expiresAt: requested.subscriptionExpiresAt,
    },
  ): Promise<PremiumAccess> {
    const { access } = await this.#dependencies.premiumAccessProjector.project({
      userId,
      now: now(),
      eventChain: { storeSubscriptionId: eventChainId.value, ...chainState },
      fallback: requested,
    });
    return access;
  }

  async #createSubscription(
    user: SubscriptionUser,
    event: SubscriptionStartedEvent,
    storeSubscriptionId: StoreSubscriptionId,
    existing: Subscription | null,
  ): Promise<SubscriptionEventPayload | null> {
    const startedAt = requireDate(event.startedAt, event.kind, "Missing start time for purchase");
    const expiresAt = requireDate(
      event.periodEndsAt,
      event.kind,
      "Missing period end for purchase",
    );
    if (existing != null) {
      return null;
    }
    const { subscriptionRepository } = this.#dependencies;
    const isFirstPurchase =
      (await subscriptionRepository.findStoreEntitlements(user.id)).length === 0;
    await subscriptionRepository.create({
      userId: user.id,
      storeSubscriptionId,
      productId: event.productId,
      status: "ACTIVE",
      startedAt,
      expiresAt,
      ...(event.providerEventId != null && { lastProcessedEventId: event.providerEventId }),
      // SANDBOX 구매도 프리미엄을 준다. App Review가 운영 서버에서 sandbox로 결제를 확인한다
      environment: event.environment,
      periodType: periodTypeAfter(event) ?? null,
    });
    const access = await this.#projectUser(user.id, storeSubscriptionId, {
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: expiresAt,
    });
    return {
      ...withPremium(baseEventPayload(user, event, storeSubscriptionId.value), access),
      isFirstPurchase,
      purchasedAt: toISOString(startedAt),
      expiresAt: toISOString(expiresAt),
    };
  }

  #planTransition(
    user: SubscriptionUser,
    event: Exclude<ProcessedChainEvent, { kind: "STARTED" | "BILLING_ISSUE" }>,
    storeSubscriptionId: StoreSubscriptionId,
    subscription: Subscription,
    renewalExpiresAt: Date | undefined,
  ): SubscriptionTransition | null {
    const payload = baseEventPayload(user, event, storeSubscriptionId.value);
    const expiresAt = event.periodEndsAt;
    const eventId = event.providerEventId;
    const activeUserState: UpdateUserSubscriptionStatusData = {
      subscriptionStatus: "ACTIVE",
      ...(expiresAt != null && { subscriptionExpiresAt: expiresAt }),
    };
    return match(event)
      .returnType<SubscriptionTransition | null>()
      .with({ kind: "RENEWED" }, (renewed) => {
        if (
          renewalExpiresAt == null ||
          !subscription.renew(
            renewalExpiresAt,
            eventId,
            periodTypeAfter(renewed),
            renewed.productId,
          )
        ) {
          return null;
        }
        return {
          userState: { subscriptionStatus: "ACTIVE", subscriptionExpiresAt: renewalExpiresAt },
          payload: { ...payload, expiresAt: toISOString(renewalExpiresAt) },
        };
      })
      .with({ kind: "CANCELLED" }, { kind: "REFUNDED" }, (cancelled) => {
        const refunded = cancelled.kind === "REFUNDED";
        const cancellationExpiresAt = expiresAt ?? subscription.expiresAt;
        if (
          !subscription.cancel({
            refunded,
            cancelledAt: now(),
            eventId,
            eventPeriodType: cancelled.periodKind,
            eventExpiresAt: expiresAt,
          })
        ) {
          return null;
        }
        return {
          userState: refunded
            ? { subscriptionStatus: "FREE", subscriptionExpiresAt: null }
            : {
                subscriptionStatus: resolveCancellationUserStatus(cancellationExpiresAt),
                subscriptionExpiresAt: cancellationExpiresAt,
              },
          // 해지는 이벤트에 만료 시각이 없어도 행이 아는 이용 종료 시각을 알린다
          payload: { ...payload, expiresAt: toISOString(cancellationExpiresAt) },
          chainExpiresAt: cancellationExpiresAt,
        };
      })
      .with({ kind: "UNCANCELLED" }, () =>
        subscription.uncancel(expiresAt, eventId) ? { userState: activeUserState, payload } : null,
      )
      .with({ kind: "EXPIRED" }, () => {
        if (!subscription.expire(expiresAt ?? null, eventId, now())) {
          return null;
        }
        return {
          userState: { subscriptionStatus: "FREE", subscriptionExpiresAt: null },
          payload,
        };
      })
      .with({ kind: "PRODUCT_CHANGE_SCHEDULED" }, (changed) =>
        subscription.reserveProductChange({
          newProductId: changed.newProductId,
          expiresAt,
          eventId,
        })
          ? { userState: activeUserState, payload }
          : null,
      )
      .with({ kind: "EXTENDED" }, () =>
        subscription.extend(expiresAt, eventId) ? { userState: activeUserState, payload } : null,
      )
      .exhaustive();
  }

  #logStarted(event: StoreSubscriptionEvent): void {
    this.#dependencies.logger.log({
      event: BillingLogEvent.WEBHOOK_STARTED,
      eventKind: event.kind,
      eventId: event.providerEventId,
      environment: event.environment ?? "UNKNOWN",
    });
  }

  #logDuplicate(event: StoreSubscriptionEvent, userId: string): void {
    this.#dependencies.logger.debug({
      event: BillingLogEvent.WEBHOOK_DUPLICATE,
      eventKind: event.kind,
      userId,
      eventId: event.providerEventId,
    });
  }

  #logCompleted(event: StoreSubscriptionEvent, userId: string): void {
    this.#dependencies.logger.log({
      event: BillingLogEvent.WEBHOOK_COMPLETED,
      eventKind: event.kind,
      userId,
      environment: event.environment ?? "UNKNOWN",
    });
  }
}
