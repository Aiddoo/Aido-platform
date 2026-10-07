import { type RevenueCatWebhookPayload, revenueCatWebhookPayloadSchema } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { match } from "ts-pattern";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { toISOString } from "#api/shared/domain/date/utils/format";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type { Subscription } from "../../../domain/aggregates/subscriptions/subscription.aggregate.js";
import {
  isRefundCancellation,
  resolveCancellationUserStatus,
} from "../../../domain/services/subscriptions/cancellation-user-status.js";
import { resolveNegativeSubscriptionProjection } from "../../../domain/services/subscriptions/negative-subscription-projection.policy.js";
import { TransactionId } from "../../../domain/value-objects/subscriptions/transaction-id.vo.js";
import { BillingLogEvent } from "../../observability/subscriptions/billing-log.events.js";
import type { SubscriptionCachePort } from "../../ports/subscriptions/subscription-cache.port.js";
import type { SubscriptionEventNotifierPort } from "../../ports/subscriptions/subscription-event-notifier.port.js";
import type { SubscriptionEventReceiptRepositoryPort } from "../../ports/subscriptions/subscription-event-receipt.repository.port.js";
import type { SubscriptionUserMutationLockPort } from "../../ports/subscriptions/subscription-user-mutation-lock.port.js";
import type { SubscriptionWebhookLockPort } from "../../ports/subscriptions/subscription-webhook-lock.port.js";
import type {
  SubscriptionRepositoryPort,
  SubscriptionUser,
  UpdateUserSubscriptionStatusData,
} from "../../ports/subscriptions/subscription.repository.port.js";
import type { SubscriptionEventPayload } from "../../types/subscriptions/subscription-event.payload.js";
import { baseEventPayload } from "./subscription-event-payload.mapper.js";
import {
  nullableExpiresAt,
  optionalExpiresAt,
  requireExpiresAt,
  requirePurchasedAt,
} from "./subscription-webhook-timestamps.js";

type RevenueCatEvent = RevenueCatWebhookPayload["event"];

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
  readonly logger: ApplicationLogger;
}

interface SubscriptionTransition {
  readonly userState: UpdateUserSubscriptionStatusData;
  readonly payload: SubscriptionEventPayload;
}

export class HandleWebhookEvent {
  readonly #dependencies: HandleWebhookEventDependencies;

  constructor(dependencies: HandleWebhookEventDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: HandleWebhookEventInput): Promise<{ received: true }> {
    const parseResult = revenueCatWebhookPayloadSchema.safeParse(input.body);
    if (!parseResult.success) {
      this.#dependencies.logger.warn({
        event: BillingLogEvent.WEBHOOK_INVALID,
        issueCount: parseResult.error.issues.length,
      });
      return { received: true };
    }

    const payload = parseResult.data;
    try {
      await this.#process(payload.event);
    } catch (error) {
      if (
        error instanceof ApplicationException &&
        error.errorCode === ErrorCode.SUBSCRIPTION_1605
      ) {
        this.#dependencies.logger.warn({ event: BillingLogEvent.WEBHOOK_LOCK_CONTENDED });
        throw error;
      }

      // 기존 실패 보고와 HTTP 200 계약을 유지한다.
      this.#dependencies.notifier.reportWebhookFailure(error, payload);
      this.#dependencies.logger.error({
        event: BillingLogEvent.WEBHOOK_FAILED,
        eventType: payload.event.type,
        errorCode: error instanceof ApplicationException ? error.errorCode : undefined,
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
    }

    return { received: true };
  }

  async #process(event: RevenueCatEvent): Promise<void> {
    const { subscriptionRepository, webhookLock, unitOfWork, userMutationLock, receiptRepository } =
      this.#dependencies;
    this.#dependencies.logger.log({
      event: BillingLogEvent.WEBHOOK_STARTED,
      eventType: event.type,
      eventId: event.id,
    });
    const release = await webhookLock.acquire(event.app_user_id);
    if (release === null) {
      throw new ApplicationException(ErrorCode.SUBSCRIPTION_1605, { appUserId: event.app_user_id });
    }

    try {
      const user = await subscriptionRepository.findUserByAppUserId(event.app_user_id);
      if (user === null) {
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
          eventId !== undefined &&
          !(await receiptRepository.claim({
            eventId,
            eventType: event.type,
            processedAt: now(),
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

        const transactionId = event.original_transaction_id ?? event.transaction_id;
        const subscription =
          transactionId !== undefined && transactionId !== ""
            ? await subscriptionRepository.findByRevenueCatId(transactionId)
            : null;
        // 배포 이전 마지막 이벤트 ID도 중복 처리하지 않는다.
        if (eventId !== undefined && subscription?.wasProcessedWith(eventId)) return null;
        return this.#applyEvent(user, event, subscription, eventId);
      });

      if (eventPayload === null) {
        this.#dependencies.logger.debug({
          event: BillingLogEvent.WEBHOOK_NO_CHANGE,
          eventType: event.type,
          userId: user.id,
        });
        return;
      }
      await this.#dependencies.cache.invalidate(user.id);
      this.#dependencies.notifier.notifySubscriptionEvent(eventPayload);
      if (event.type === "BILLING_ISSUE") this.#dependencies.notifier.notifyBillingIssue(user.id);
      this.#dependencies.logger.log({
        event: BillingLogEvent.WEBHOOK_COMPLETED,
        eventType: event.type,
        userId: user.id,
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
        "TRANSFER",
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
    if (event.type === "TRANSFER") {
      const existingUser = await subscriptionRepository.findUserByAppUserId(event.app_user_id);
      if (existingUser?.id !== user.id) {
        await subscriptionRepository.updateUserSubscriptionStatus(user.id, {
          subscriptionStatus: existingUser?.subscriptionStatus ?? "ACTIVE",
          revenueCatUserId: event.app_user_id,
        });
      }
      return baseEventPayload(user, event);
    }

    const transactionId = TransactionId.resolve(
      event.original_transaction_id,
      event.transaction_id,
      event.type,
    ).value;
    if (event.type === "BILLING_ISSUE") return baseEventPayload(user, event, transactionId);
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
    if (subscription === null) {
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

    const transition = this.#planTransition(
      user,
      event,
      transactionId,
      subscription,
      eventId,
      renewalExpiresAt,
    );
    if (transition === null) return null;
    await subscriptionRepository.updateStatus(transactionId, subscription.persistenceState);
    const userState = await this.#resolveUserProjection(
      user.id,
      transactionId,
      transition.userState,
    );
    if (userState !== null) {
      await subscriptionRepository.updateUserSubscriptionStatus(user.id, userState);
    }
    return transition.payload;
  }

  async #resolveUserProjection(
    userId: string,
    transactionId: string,
    requestedState: UpdateUserSubscriptionStatusData,
  ): Promise<UpdateUserSubscriptionStatusData | null> {
    if (
      requestedState.subscriptionStatus !== "FREE" &&
      requestedState.subscriptionStatus !== "CANCELLED"
    ) {
      return requestedState;
    }

    const { subscriptionRepository } = this.#dependencies;
    const user = await subscriptionRepository.findUserById(userId);
    if (user === null) return requestedState;
    const at = now();
    const otherExpiresAt = await subscriptionRepository.findOtherEntitlementExpiry(
      userId,
      transactionId,
      at,
    );
    const projection = resolveNegativeSubscriptionProjection({
      currentStatus: user.subscriptionStatus,
      currentExpiresAt: user.subscriptionExpiresAt,
      otherExpiresAt,
      at,
    });
    if (projection === null) return requestedState;
    if (projection.expiresAt.getTime() === user.subscriptionExpiresAt?.getTime()) return null;
    return { subscriptionStatus: projection.status, subscriptionExpiresAt: projection.expiresAt };
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
    if (existing !== null) return null;
    const { subscriptionRepository } = this.#dependencies;
    await subscriptionRepository.create({
      userId: user.id,
      revenueCatId: transactionId,
      productId: event.product_id,
      status: "ACTIVE",
      startedAt,
      expiresAt,
      ...(eventId !== undefined && { lastProcessedEventId: eventId }),
    });
    await subscriptionRepository.updateUserSubscriptionStatus(user.id, {
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: expiresAt,
    });
    return {
      ...baseEventPayload(user, event, transactionId),
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
      ...(expiresAt !== undefined && { subscriptionExpiresAt: expiresAt }),
    };
    const payloadWithExpiry = (): SubscriptionEventPayload => ({
      ...payload,
      expiresAt: expiresAt === undefined ? undefined : toISOString(expiresAt),
    });
    return match(event.type)
      .with("RENEWAL", () => {
        if (renewalExpiresAt === undefined || !subscription.renew(renewalExpiresAt, eventId))
          return null;
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
        subscription.cancel({ refunded, cancelledAt: now(), eventId });
        return {
          userState: refunded
            ? { subscriptionStatus: "FREE", subscriptionExpiresAt: null }
            : {
                subscriptionStatus: resolveCancellationUserStatus(cancellationExpiresAt),
                subscriptionExpiresAt: cancellationExpiresAt,
              },
          payload: { ...payloadWithExpiry(), cancelReason: event.cancel_reason },
        } satisfies SubscriptionTransition;
      })
      .with("UNCANCELLATION", () => {
        subscription.uncancel(expiresAt, eventId);
        return { userState: activeUserState, payload: payloadWithExpiry() };
      })
      .with("EXPIRATION", () => {
        if (!subscription.expire(nullableExpiresAt(event.expiration_at_ms), eventId)) return null;
        return {
          userState: { subscriptionStatus: "FREE", subscriptionExpiresAt: null },
          payload,
        } satisfies SubscriptionTransition;
      })
      .with("PRODUCT_CHANGE", () => {
        subscription.changeProduct(event.product_id, expiresAt, eventId);
        return { userState: activeUserState, payload: payloadWithExpiry() };
      })
      .with("SUBSCRIPTION_EXTENDED", () => {
        subscription.extend(expiresAt, eventId);
        return { userState: activeUserState, payload: payloadWithExpiry() };
      })
      .otherwise(() => null);
  }
}
