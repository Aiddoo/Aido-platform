import {
  type RevenueCatWebhookPayload,
  revenueCatTransferWebhookPayloadSchema,
  revenueCatWebhookPayloadSchema,
} from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { sortBy, uniq, uniqBy } from "es-toolkit";
import { match } from "ts-pattern";
import { z } from "zod";

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
import {
  isRefundCancellation,
  resolveCancellationUserStatus,
} from "../../../domain/services/subscriptions/cancellation-user-status.js";
import { TransactionId } from "../../../domain/value-objects/subscriptions/transaction-id.vo.js";
import { BillingLogEvent } from "../../observability/subscriptions/billing-log.events.js";
import type { StoreSubscriptionReconcileSchedulerPort } from "../../ports/subscriptions/store-subscription-reconcile.scheduler.port.js";
import type { SubscriptionCachePort } from "../../ports/subscriptions/subscription-cache.port.js";
import type {
  SubscriptionEventNotifierPort,
  WebhookFailureContext,
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
import type { SubscriptionEventPayload } from "../../types/subscriptions/subscription-event.payload.js";
import {
  baseEventPayload,
  lifecycleEventOf,
  periodTypeAfter,
  premiumGrantImpactOf,
  transferEventPayload,
  type TransferEvent,
} from "./subscription-event-payload.mapper.js";
import {
  nullableExpiresAt,
  optionalExpiresAt,
  requireExpiresAt,
  requirePurchasedAt,
} from "./subscription-webhook-timestamps.js";

type RevenueCatEvent = RevenueCatWebhookPayload["event"];

/** 형식이 틀린 웹훅도 어떤 이벤트였는지는 로그에 남긴다. */
const invalidEventTypeSchema = z.looseObject({ event: z.looseObject({ type: z.string() }) });

export interface HandleWebhookEventInput {
  readonly body: unknown;
}

interface HandleWebhookEventDependencies {
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
 * 보상 기간 판단에 넘길 체인 상태는 이벤트를 적용한 행 그대로다. 취소는 CANCELLED(만료 시각까지),
 * 만료 시각이 없는 이벤트는 저장된 만료 시각, 만료는 행을 지우지 않고 스토어가 끝난 시각을 남겨
 * 쌓아 둔 보상이 웹훅 도착 시각이 아니라 그 시각부터 이어지게 한다.
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

export class HandleWebhookEvent {
  readonly #dependencies: HandleWebhookEventDependencies;

  constructor(dependencies: HandleWebhookEventDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: HandleWebhookEventInput): Promise<{ received: true }> {
    // RevenueCat TRANSFER에는 app_user_id·product_id가 없어 전용 스키마로 먼저 받는다
    const transfer = revenueCatTransferWebhookPayloadSchema.safeParse(input.body);
    if (transfer.success) {
      const event = transfer.data.event;
      await this.#guard({ eventType: event.type, eventId: event.id, store: event.store }, () =>
        this.#processTransfer({
          id: event.id,
          type: event.type,
          store: event.store,
          environment: event.environment,
          receivers: event.transferred_to,
          transferredFrom: event.transferred_from,
        }),
      );
      return { received: true };
    }

    const parseResult = revenueCatWebhookPayloadSchema.safeParse(input.body);
    if (!parseResult.success) {
      const invalid = invalidEventTypeSchema.safeParse(input.body);
      this.#dependencies.logger.warn({
        event: BillingLogEvent.WEBHOOK_INVALID,
        eventType: invalid.success ? invalid.data.event.type : undefined,
        issueCount: parseResult.error.issues.length,
      });
      return { received: true };
    }

    const event = parseResult.data.event;
    await this.#guard(
      {
        eventType: event.type,
        eventId: event.id,
        store: event.store,
        productId: event.product_id,
      },
      () =>
        event.type === "TRANSFER"
          ? this.#processTransfer({
              id: event.id,
              type: event.type,
              store: event.store,
              environment: event.environment,
              receivers: [event.app_user_id, ...(event.transferred_to ?? [])],
              transferredFrom: event.transferred_from ?? [],
            })
          : this.#process(event),
    );
    return { received: true };
  }

  /** 처리 실패는 보고하고 HTTP 200으로 승인한다. 잠금 경합만 다시 보내게 한다. */
  async #guard(context: WebhookFailureContext, run: () => Promise<void>): Promise<void> {
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

      // 기존 실패 보고와 HTTP 200 계약을 유지한다.
      this.#dependencies.notifier.reportWebhookFailure(error, context);
      this.#dependencies.logger.error({
        event: BillingLogEvent.WEBHOOK_FAILED,
        eventType: context.eventType,
        errorCode: error instanceof ApplicationException ? error.errorCode : undefined,
        errorType: toErrorType(error),
      });
    }
  }

  /**
   * TRANSFER: 구매를 넘겨받은 사용자(transferred_to)에게 넘겨준 사용자(transferred_from)의 체인 행을 옮기고
   * 둘 다 다시 계산한다. TRANSFER에는 체인 ID가 없어 넘겨준 사용자의 행 전체를 옮기고, 같은 체인의 이벤트가
   * 다시 그 사용자로 오면 claimChain이 되돌린다. 행이 없으면(탈퇴로 지워짐) 다음 RENEWAL이 체인을 이어 받는다.
   */
  async #processTransfer(event: TransferEvent): Promise<void> {
    const { subscriptionRepository, webhookLock, unitOfWork, userMutationLock, receiptRepository } =
      this.#dependencies;
    const receiverAppUserIds = uniq(event.receivers);
    const lockKey = receiverAppUserIds[0] ?? "";
    this.#dependencies.logger.log({
      event: BillingLogEvent.WEBHOOK_STARTED,
      eventType: event.type,
      eventId: event.id,
      environment: event.environment ?? "UNKNOWN",
    });
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
      const eventId = event.id === "" ? undefined : event.id;
      const result = await unitOfWork.run(async () => {
        // 넘겨준·넘겨받은 사용자를 id 순으로 잠가 반대 방향 TRANSFER와 교착하지 않는다
        for (const user of sortBy([receiver, ...previousOwners], [(user) => user.id])) {
          if (!(await userMutationLock.lockById(user.id)) && user.id === receiver.id) {
            throw new ApplicationException(ErrorCode.SUBSCRIPTION_1602, { appUserId: lockKey });
          }
        }
        if (
          eventId != null &&
          !(await receiptRepository.claim({
            eventId,
            eventType: event.type,
            processedAt: now(),
            environment: event.environment ?? null,
          }))
        ) {
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
        this.#dependencies.logger.debug({
          event: BillingLogEvent.WEBHOOK_DUPLICATE,
          eventType: event.type,
          userId: receiver.id,
          eventId,
        });
        return;
      }
      for (const user of [receiver, ...previousOwners]) {
        await this.#dependencies.cache.invalidate(user.id);
      }
      this.#dependencies.notifier.notifySubscriptionEvent(result);
      this.#dependencies.logger.log({
        event: BillingLogEvent.WEBHOOK_COMPLETED,
        eventType: event.type,
        userId: receiver.id,
        environment: event.environment ?? "UNKNOWN",
      });
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

  async #process(event: RevenueCatEvent): Promise<void> {
    const { subscriptionRepository, webhookLock, unitOfWork, userMutationLock, receiptRepository } =
      this.#dependencies;
    this.#dependencies.logger.log({
      event: BillingLogEvent.WEBHOOK_STARTED,
      eventType: event.type,
      eventId: event.id,
      environment: event.environment ?? "UNKNOWN",
    });
    const release = await webhookLock.acquire(event.app_user_id);
    if (release == null) {
      throw new ApplicationException(ErrorCode.SUBSCRIPTION_1605, { appUserId: event.app_user_id });
    }

    try {
      const user = await subscriptionRepository.findUserByAppUserId(event.app_user_id);
      if (user == null) {
        throw new ApplicationException(ErrorCode.SUBSCRIPTION_1602, {
          appUserId: event.app_user_id,
        });
      }
      if (!this.#isSupported(event)) {
        this.#dependencies.logger.log({
          event: BillingLogEvent.WEBHOOK_IGNORED,
          eventType: event.type,
          userId: user.id,
        });
        return;
      }

      const eventId = event.id === "" ? undefined : event.id;
      const eventPayload = await unitOfWork.run(async () => {
        if (!(await userMutationLock.lockById(user.id))) {
          throw new ApplicationException(ErrorCode.SUBSCRIPTION_1602, {
            appUserId: event.app_user_id,
          });
        }
        // 처리 원장은 업무 변경과 함께 커밋한다. 실패한 트랜잭션은 다시 처리할 수 있다.
        if (
          eventId != null &&
          !(await receiptRepository.claim({
            eventId,
            eventType: event.type,
            processedAt: now(),
            environment: event.environment ?? null,
          }))
        ) {
          this.#dependencies.logger.debug({
            event: BillingLogEvent.WEBHOOK_DUPLICATE,
            eventType: event.type,
            userId: user.id,
            eventId,
          });
          return null;
        }

        // 웹훅은 신호다. 늦거나 빠진 이벤트로 어긋난 상태를 스토어에서 다시 읽어 맞추도록 함께 커밋한다
        await this.#dependencies.reconcileScheduler.schedule(user.id, now());
        const transactionId = event.original_transaction_id ?? event.transaction_id;
        const subscription =
          transactionId != null && transactionId !== ""
            ? await subscriptionRepository.findByRevenueCatId(transactionId)
            : null;
        // 배포 이전 마지막 이벤트 ID도 중복 처리하지 않는다.
        if (eventId != null && subscription?.wasProcessedWith(eventId)) {
          return null;
        }
        return this.#applyEvent(user, event, subscription, eventId);
      });

      if (eventPayload == null) {
        this.#dependencies.logger.debug({
          event: BillingLogEvent.WEBHOOK_NO_CHANGE,
          eventType: event.type,
          userId: user.id,
        });
        return;
      }
      await this.#dependencies.cache.invalidate(user.id);
      this.#dependencies.notifier.notifySubscriptionEvent(eventPayload);
      if (event.type === "BILLING_ISSUE") {
        this.#dependencies.notifier.notifyBillingIssue(user.id);
      }
      this.#dependencies.logger.log({
        event: BillingLogEvent.WEBHOOK_COMPLETED,
        eventType: event.type,
        userId: user.id,
        environment: event.environment ?? "UNKNOWN",
      });
    } finally {
      await release();
    }
  }

  #isSupported(event: RevenueCatEvent): boolean {
    return match(event.type)
      .with(
        "INITIAL_PURCHASE",
        "NON_RENEWING_PURCHASE",
        "RENEWAL",
        "CANCELLATION",
        "UNCANCELLATION",
        "EXPIRATION",
        "BILLING_ISSUE",
        "PRODUCT_CHANGE",
        "SUBSCRIPTION_EXTENDED",
        () => true,
      )
      .otherwise(() => false);
  }

  async #applyEvent(
    user: SubscriptionUser,
    event: RevenueCatEvent,
    subscription: Subscription | null,
    eventId: string | undefined,
  ): Promise<SubscriptionEventPayload | null> {
    const { subscriptionRepository } = this.#dependencies;
    const transactionId = TransactionId.resolve(
      event.original_transaction_id,
      event.transaction_id,
      event.type,
    ).value;
    if (event.type === "BILLING_ISSUE") {
      return this.#enterBillingGrace(user, event, transactionId, subscription, eventId);
    }
    if (event.type === "INITIAL_PURCHASE" || event.type === "NON_RENEWING_PURCHASE") {
      return this.#createSubscription(user, event, transactionId, subscription, eventId);
    }

    // RENEWAL이 요구하는 시각 오류는 기존처럼 구독 없음 오류보다 우선한다.
    const renewalExpiresAt =
      event.type === "RENEWAL"
        ? requireExpiresAt(
            event.expiration_at_ms,
            event.type,
            "Missing expiration_at_ms for RENEWAL",
          )
        : undefined;
    if (subscription == null && renewalExpiresAt != null) {
      return this.#adoptRenewedChain(user, event, transactionId, renewalExpiresAt, eventId);
    }
    if (subscription == null) {
      throw new ApplicationException(
        ErrorCode.SUBSCRIPTION_1604,
        event.type === "RENEWAL"
          ? {
              reason: `Subscription not found for RENEWAL: ${transactionId}`,
              eventType: event.type,
            }
          : { reason: `Subscription not found: ${transactionId}` },
      );
    }

    // 체인의 이벤트가 다른 사용자로 오면 구매가 옮겨 간 것이다. 행의 소유자를 이벤트 사용자로 맞춰
    // 프리미엄 판단이 User projection 대신 행 자체를 믿을 수 있게 한다
    await subscriptionRepository.claimChain(transactionId, user.id);
    const transition = this.#planTransition(
      user,
      event,
      transactionId,
      subscription,
      eventId,
      renewalExpiresAt,
    );
    if (transition == null) {
      return null;
    }
    await subscriptionRepository.updateStatus(transactionId, subscription.persistenceState);
    const access = await this.#projectUser(user.id, transactionId, transition.userState, {
      ...chainStateOf(subscription),
      ...(transition.chainExpiresAt != null && { expiresAt: transition.chainExpiresAt }),
    });
    return withPremiumGrantImpact(transition.payload, access);
  }

  /**
   * 결제 실패. 스토어가 결제를 다시 시도하는 결제 유예 동안 RevenueCat은 엔타이틀먼트를 유지하므로 그 끝을
   * 행에 남겨 프리미엄과 쌓아 둔 보상의 시작을 미룬다. 행이 없으면 기존처럼 알림만 보낸다.
   */
  async #enterBillingGrace(
    user: SubscriptionUser,
    event: RevenueCatEvent,
    transactionId: string,
    subscription: Subscription | null,
    eventId: string | undefined,
  ): Promise<SubscriptionEventPayload> {
    const payload = baseEventPayload(user, event, transactionId);
    if (
      subscription == null ||
      !subscription.enterBillingGrace({
        gracePeriodEndsAt: nullableExpiresAt(event.grace_period_expiration_at_ms),
        periodExpiresAt: nullableExpiresAt(event.expiration_at_ms),
        eventId,
      })
    ) {
      return payload;
    }
    const { subscriptionRepository } = this.#dependencies;
    await subscriptionRepository.claimChain(transactionId, user.id);
    await subscriptionRepository.updateStatus(transactionId, subscription.persistenceState);
    const access = await this.#projectUser(
      user.id,
      transactionId,
      { subscriptionStatus: "ACTIVE", subscriptionExpiresAt: subscription.expiresAt },
      chainStateOf(subscription),
    );
    return withPremiumGrantImpact(payload, access);
  }

  /**
   * 행이 없는 체인의 RENEWAL. 탈퇴로 행이 함께 지워진 계정의 구매를 새 계정이 복원하면 TRANSFER로 옮길
   * 행이 없고, TRANSFER payload에는 상품·만료 시각이 없다. 갱신 payload로 체인 행을 만들어 이어 받는다.
   */
  async #adoptRenewedChain(
    user: SubscriptionUser,
    event: RevenueCatEvent,
    transactionId: string,
    expiresAt: Date,
    eventId: string | undefined,
  ): Promise<SubscriptionEventPayload> {
    const startedAt = optionalExpiresAt(event.purchased_at_ms) ?? now();
    await this.#dependencies.subscriptionRepository.create({
      userId: user.id,
      revenueCatId: transactionId,
      productId: event.product_id,
      status: "ACTIVE",
      startedAt,
      expiresAt,
      ...(eventId != null && { lastProcessedEventId: eventId }),
      environment: event.environment ?? null,
      periodType: periodTypeAfter(event) ?? null,
    });
    this.#dependencies.logger.log({
      event: BillingLogEvent.SUBSCRIPTION_CHAIN_ADOPTED,
      eventType: event.type,
      userId: user.id,
    });
    const access = await this.#projectUser(user.id, transactionId, {
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: expiresAt,
    });
    return withPremiumGrantImpact(
      {
        ...baseEventPayload(user, event, transactionId),
        expiresAt: toISOString(expiresAt),
        priceUsd: event.price,
        priceInPurchasedCurrency: event.price_in_purchased_currency,
        purchasedCurrency: event.currency,
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
    event: RevenueCatEvent,
    transactionId: string,
    existing: Subscription | null,
    eventId: string | undefined,
  ): Promise<SubscriptionEventPayload | null> {
    const startedAt = requirePurchasedAt(
      event.purchased_at_ms,
      event.type,
      "Missing purchased_at_ms for INITIAL_PURCHASE",
    );
    const expiresAt = requireExpiresAt(
      event.expiration_at_ms,
      event.type,
      "Missing expiration_at_ms for INITIAL_PURCHASE",
    );
    if (existing != null) {
      return null;
    }
    const { subscriptionRepository } = this.#dependencies;
    const isFirstPurchase =
      (await subscriptionRepository.findStoreEntitlements(user.id)).length === 0;
    await subscriptionRepository.create({
      userId: user.id,
      revenueCatId: transactionId,
      productId: event.product_id,
      status: "ACTIVE",
      startedAt,
      expiresAt,
      ...(eventId != null && { lastProcessedEventId: eventId }),
      // SANDBOX 구매도 프리미엄을 준다. App Review가 운영 서버에서 sandbox로 결제를 확인한다
      environment: event.environment ?? null,
      periodType: periodTypeAfter(event) ?? null,
    });
    const access = await this.#projectUser(user.id, transactionId, {
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: expiresAt,
    });
    return {
      ...withPremiumGrantImpact(baseEventPayload(user, event, transactionId), access),
      isFirstPurchase,
      purchasedAt: toISOString(startedAt),
      expiresAt: toISOString(expiresAt),
      priceUsd: event.price,
      priceInPurchasedCurrency: event.price_in_purchased_currency,
      purchasedCurrency: event.currency,
    };
  }

  #planTransition(
    user: SubscriptionUser,
    event: RevenueCatEvent,
    transactionId: string,
    subscription: Subscription,
    eventId: string | undefined,
    renewalExpiresAt: Date | undefined,
  ): SubscriptionTransition | null {
    const payload = baseEventPayload(user, event, transactionId);
    const expiresAt = optionalExpiresAt(event.expiration_at_ms);
    const activeUserState: UpdateUserSubscriptionStatusData = {
      subscriptionStatus: "ACTIVE",
      ...(expiresAt != null && { subscriptionExpiresAt: expiresAt }),
    };
    const payloadWithExpiry = (): SubscriptionEventPayload => ({
      ...payload,
      expiresAt: expiresAt == null ? undefined : toISOString(expiresAt),
    });
    return match(event.type)
      .with("RENEWAL", () => {
        if (
          renewalExpiresAt == null ||
          !subscription.renew(renewalExpiresAt, eventId, periodTypeAfter(event), event.product_id)
        ) {
          return null;
        }
        return {
          userState: { subscriptionStatus: "ACTIVE", subscriptionExpiresAt: renewalExpiresAt },
          payload: {
            ...payload,
            expiresAt: toISOString(renewalExpiresAt),
            priceUsd: event.price,
            priceInPurchasedCurrency: event.price_in_purchased_currency,
            purchasedCurrency: event.currency,
          },
        } satisfies SubscriptionTransition;
      })
      .with("CANCELLATION", () => {
        const refunded = isRefundCancellation(event.cancel_reason);
        const cancellationExpiresAt = expiresAt ?? subscription.expiresAt;
        if (
          !subscription.cancel({
            refunded,
            cancelledAt: now(),
            eventId,
            eventPeriodType: lifecycleEventOf(event).periodType,
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
          payload: { ...payloadWithExpiry(), cancelReason: event.cancel_reason },
          chainExpiresAt: cancellationExpiresAt,
        } satisfies SubscriptionTransition;
      })
      .with("UNCANCELLATION", () =>
        subscription.uncancel(expiresAt, eventId)
          ? { userState: activeUserState, payload: payloadWithExpiry() }
          : null,
      )
      .with("EXPIRATION", () => {
        if (!subscription.expire(nullableExpiresAt(event.expiration_at_ms), eventId, now())) {
          return null;
        }
        return {
          userState: { subscriptionStatus: "FREE", subscriptionExpiresAt: null },
          payload,
        } satisfies SubscriptionTransition;
      })
      .with("PRODUCT_CHANGE", () =>
        subscription.reserveProductChange({
          newProductId: event.new_product_id,
          expiresAt,
          eventId,
        })
          ? { userState: activeUserState, payload: payloadWithExpiry() }
          : null,
      )
      .with("SUBSCRIPTION_EXTENDED", () =>
        subscription.extend(expiresAt, eventId)
          ? { userState: activeUserState, payload: payloadWithExpiry() }
          : null,
      )
      .otherwise(() => null);
  }
}
