import { ErrorCode } from "@aido/api/errors";
import { sortBy, uniq, uniqBy } from "es-toolkit";
import { match } from "ts-pattern";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { now } from "#api/shared/domain/date/utils/core";
import { toISOString } from "#api/shared/domain/date/utils/format";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type { Subscription } from "../../../domain/aggregates/subscriptions/subscription.aggregate.js";
import type {
  PremiumAccess,
  StoreEventChainState,
} from "../../../domain/policies/subscriptions/premium-access.policy.js";
import { resolveCancellationUserStatus } from "../../../domain/services/subscriptions/cancellation-user-status.js";
import { BillingLogEvent } from "../../observability/subscriptions/billing-log.events.js";
import type { StoreSubscriptionReconcileSchedulerPort } from "../../ports/subscriptions/store-subscription-reconcile.scheduler.port.js";
import type { SubscriptionCachePort } from "../../ports/subscriptions/subscription-cache.port.js";
import type {
  StoreSubscriptionEventFailureContext,
  SubscriptionEventNotifierPort,
} from "../../ports/subscriptions/subscription-event-notifier.port.js";
import type { SubscriptionEventReceiptRepositoryPort } from "../../ports/subscriptions/subscription-event-receipt.repository.port.js";
import type { SubscriptionUserMutationLockPort } from "../../ports/subscriptions/subscription-user-mutation-lock.port.js";
import type { SubscriptionWebhookLockPort } from "../../ports/subscriptions/subscription-webhook-lock.port.js";
import type {
  SubscriptionRepositoryPort,
  SubscriptionUser,
  UpdateUserSubscriptionStatusData,
} from "../../ports/subscriptions/subscription.repository.port.js";
import type { PremiumAccessProjector } from "../../services/subscriptions/premium-access-projector.service.js";
import type {
  StoreSubscriptionChainEvent,
  StoreSubscriptionEvent,
  SubscriptionBillingIssueEvent,
  SubscriptionRenewedEvent,
  SubscriptionStartedEvent,
  SubscriptionTransferredEvent,
} from "../../types/subscriptions/store-subscription-event.js";
import type { SubscriptionEventPayload } from "../../types/subscriptions/subscription-event.payload.js";
import {
  baseEventPayload,
  periodTypeAfter,
  premiumGrantImpactOf,
  transferEventPayload,
} from "./subscription-event-payload.mapper.js";

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
  readonly logger: ApplicationLogger;
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
function chainStateOf(subscription: Subscription): Omit<StoreEventChainState, "revenueCatId"> {
  return {
    status: subscription.status,
    expiresAt: subscription.expiresAt,
    gracePeriodEndsAt: subscription.gracePeriodEndsAt,
    periodType: subscription.periodType,
  };
}

function withPremiumGrantImpact(
  payload: SubscriptionEventPayload,
  access: PremiumAccess,
): SubscriptionEventPayload {
  const premiumGrantImpact = premiumGrantImpactOf(access);
  return premiumGrantImpact == null ? payload : { ...payload, premiumGrantImpact };
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
    await this.#guard(failureContextOf(event), () =>
      event.kind === "TRANSFERRED" ? this.#processTransfer(event) : this.#process(event),
    );
  }

  // 처리 실패는 보고하고 받은 것으로 닫는다. 잠금 경합만 공급자가 다시 보내게 한다
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
      this.#dependencies.notifier.reportWebhookFailure(error, context);
      this.#dependencies.logger.error({
        event: BillingLogEvent.WEBHOOK_FAILED,
        eventKind: context.kind,
        errorCode: error instanceof ApplicationException ? error.errorCode : undefined,
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
        for (const user of [receiver, ...previousOwners]) {
          await this.#dependencies.premiumAccessProjector.project({ userId: user.id, now: at });
        }
        return transferEventPayload(receiver, event, lockKey);
      });

      if (result == null) {
        this.#logDuplicate(event, receiver.id);
        return;
      }
      await Promise.all(
        [receiver, ...previousOwners].map((user) => this.#dependencies.cache.invalidate(user.id)),
      );
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

  async #process(event: StoreSubscriptionChainEvent): Promise<void> {
    const { subscriptionRepository, webhookLock, unitOfWork, userMutationLock } =
      this.#dependencies;
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
      if (event.kind === "IGNORED") {
        this.#dependencies.logger.log({
          event: BillingLogEvent.WEBHOOK_IGNORED,
          eventKind: event.kind,
          userId: user.id,
        });
        return;
      }

      const eventPayload = await unitOfWork.run(async () => {
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
            ? await subscriptionRepository.findByRevenueCatId(event.storeSubscriptionId)
            : null;
        // 배포 이전 마지막 이벤트 ID도 중복 처리하지 않는다
        if (
          event.providerEventId != null &&
          subscription?.wasProcessedWith(event.providerEventId)
        ) {
          return null;
        }
        return this.#applyEvent(user, event, subscription);
      });

      if (eventPayload == null) {
        this.#dependencies.logger.debug({
          event: BillingLogEvent.WEBHOOK_NO_CHANGE,
          eventKind: event.kind,
          userId: user.id,
        });
        return;
      }
      await this.#dependencies.cache.invalidate(user.id);
      this.#dependencies.notifier.notifySubscriptionEvent(eventPayload);
      if (event.kind === "BILLING_ISSUE") {
        this.#dependencies.notifier.notifyBillingIssue(user.id);
      }
      this.#logCompleted(event, user.id);
    } finally {
      await release();
    }
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
    const storeSubscriptionId = event.storeSubscriptionId;
    if (storeSubscriptionId == null || storeSubscriptionId === "") {
      throw new ApplicationException(ErrorCode.SUBSCRIPTION_1604, {
        reason: "Missing store subscription id",
        eventType: event.kind,
      });
    }
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
              reason: `Subscription not found for renewal: ${storeSubscriptionId}`,
              eventType: event.kind,
            }
          : { reason: `Subscription not found: ${storeSubscriptionId}` },
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
    return withPremiumGrantImpact(transition.payload, access);
  }

  /**
   * 결제 실패. 스토어가 결제를 다시 시도하는 결제 유예 동안 엔타이틀먼트가 남으므로 그 끝을 행에 남겨
   * 프리미엄과 쌓아 둔 보상의 시작을 미룬다. 행이 없으면 알림만 보낸다.
   */
  async #enterBillingGrace(
    user: SubscriptionUser,
    event: SubscriptionBillingIssueEvent,
    storeSubscriptionId: string,
    subscription: Subscription | null,
  ): Promise<SubscriptionEventPayload> {
    const payload = baseEventPayload(user, event, storeSubscriptionId);
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
    return withPremiumGrantImpact(payload, access);
  }

  /**
   * 행이 없는 체인의 갱신. 탈퇴로 행이 함께 지워진 계정의 구매를 새 계정이 복원하면 이전으로 옮길 행이 없고,
   * 이전 이벤트에는 상품·만료 시각이 없다. 갱신 이벤트로 체인 행을 만들어 이어 받는다.
   */
  async #adoptRenewedChain(
    user: SubscriptionUser,
    event: SubscriptionRenewedEvent,
    storeSubscriptionId: string,
    expiresAt: Date,
  ): Promise<SubscriptionEventPayload> {
    const startedAt = event.startedAt ?? now();
    await this.#dependencies.subscriptionRepository.create({
      userId: user.id,
      revenueCatId: storeSubscriptionId,
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
    return withPremiumGrantImpact(
      {
        ...baseEventPayload(user, event, storeSubscriptionId),
        expiresAt: toISOString(expiresAt),
        priceUsd: event.price.usd,
        priceInPurchasedCurrency: event.price.amountInPurchasedCurrency,
        purchasedCurrency: event.price.purchasedCurrency,
      },
      access,
    );
  }

  // 스토어 상태가 바뀌면 보상 기간을 함께 보고 User의 구독 projection을 다시 계산한다
  async #projectUser(
    userId: string,
    eventChainId: string,
    requested: UpdateUserSubscriptionStatusData,
    chainState: Omit<StoreEventChainState, "revenueCatId"> = {
      status: requested.subscriptionStatus,
      expiresAt: requested.subscriptionExpiresAt,
    },
  ): Promise<PremiumAccess> {
    const { access } = await this.#dependencies.premiumAccessProjector.project({
      userId,
      now: now(),
      eventChain: { revenueCatId: eventChainId, ...chainState },
      fallback: requested,
    });
    return access;
  }

  async #createSubscription(
    user: SubscriptionUser,
    event: SubscriptionStartedEvent,
    storeSubscriptionId: string,
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
      revenueCatId: storeSubscriptionId,
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
      ...withPremiumGrantImpact(baseEventPayload(user, event, storeSubscriptionId), access),
      isFirstPurchase,
      purchasedAt: toISOString(startedAt),
      expiresAt: toISOString(expiresAt),
      priceUsd: event.price.usd,
      priceInPurchasedCurrency: event.price.amountInPurchasedCurrency,
      purchasedCurrency: event.price.purchasedCurrency,
    };
  }

  #planTransition(
    user: SubscriptionUser,
    event: Exclude<ProcessedChainEvent, { kind: "STARTED" | "BILLING_ISSUE" }>,
    storeSubscriptionId: string,
    subscription: Subscription,
    renewalExpiresAt: Date | undefined,
  ): SubscriptionTransition | null {
    const payload = baseEventPayload(user, event, storeSubscriptionId);
    const expiresAt = event.periodEndsAt;
    const eventId = event.providerEventId;
    const activeUserState: UpdateUserSubscriptionStatusData = {
      subscriptionStatus: "ACTIVE",
      ...(expiresAt != null && { subscriptionExpiresAt: expiresAt }),
    };
    const payloadWithExpiry = (): SubscriptionEventPayload => ({
      ...payload,
      expiresAt: expiresAt == null ? undefined : toISOString(expiresAt),
    });
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
          payload: {
            ...payload,
            expiresAt: toISOString(renewalExpiresAt),
            priceUsd: renewed.price.usd,
            priceInPurchasedCurrency: renewed.price.amountInPurchasedCurrency,
            purchasedCurrency: renewed.price.purchasedCurrency,
          },
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
          payload: payloadWithExpiry(),
          chainExpiresAt: cancellationExpiresAt,
        };
      })
      .with({ kind: "UNCANCELLED" }, () =>
        subscription.uncancel(expiresAt, eventId)
          ? { userState: activeUserState, payload: payloadWithExpiry() }
          : null,
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
          ? { userState: activeUserState, payload: payloadWithExpiry() }
          : null,
      )
      .with({ kind: "EXTENDED" }, () =>
        subscription.extend(expiresAt, eventId)
          ? { userState: activeUserState, payload: payloadWithExpiry() }
          : null,
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
