import type { PremiumAccessCachePort } from "#api/modules/billing/premium-grants/billing-premium-grants.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { ProviderEventId } from "../../domain/provider-event-id.vo.js";
import { StoreProductId } from "../../domain/store-product-id.vo.js";
import type { StoreSubscriptionEvent } from "../../domain/store-subscription.event.js";
import type {
  StoreSubscriptionEventFailureContext,
  SubscriptionEventNotifierPort,
} from "../ports/subscription-event-notifier.port.js";
import type { SubscriptionEventOutcomeReadModel } from "../read-models/subscription-event-outcome.read-model.js";
import { isPermanentWebhookFailure, isWebhookLockContended } from "../subscriptions.errors.js";
import { SubscriptionLogEvent } from "../subscriptions.log-events.js";
import type { ApplySubscriptionChainEventUseCase } from "./apply-subscription-chain-event.use-case.js";
import type { TransferSubscriptionsUseCase } from "./transfer-subscriptions.use-case.js";

export type ApplyStoreSubscriptionEventCommand = StoreSubscriptionEvent;

export interface ApplyStoreSubscriptionEventDependencies {
  readonly applySubscriptionChainEvent: Pick<ApplySubscriptionChainEventUseCase, "execute">;
  readonly transferSubscriptions: Pick<TransferSubscriptionsUseCase, "execute">;
  readonly cache: PremiumAccessCachePort;
  readonly notifier: Pick<
    SubscriptionEventNotifierPort,
    "notifySubscriptionEvent" | "reportWebhookFailure"
  >;
  readonly logger: ApplicationLoggerPort;
}

function failureContextOf(event: StoreSubscriptionEvent): StoreSubscriptionEventFailureContext {
  return {
    kind: event.kind,
    ...(event.providerEventId != null && {
      providerEventId: ProviderEventId.reconstitute(event.providerEventId),
    }),
    ...(event.store != null && { store: event.store }),
    ...(event.environment != null && { environment: event.environment }),
    ...(event.kind !== "TRANSFERRED" && {
      productId: StoreProductId.reconstitute(event.productId),
    }),
  };
}

/**
 * 공급자 번역기가 만든 스토어 구독 이벤트를 구독 행과 프리미엄에 반영한다. 이전은 TransferSubscriptions,
 * 그 밖의 체인 이벤트는 ApplySubscriptionChainEvent가 한 트랜잭션에서 반영하고, 여기서는 실패를 나누고
 * 커밋 뒤 캐시 정리·운영 알림·로그를 맡는다.
 */
export class ApplyStoreSubscriptionEventUseCase {
  readonly #dependencies: ApplyStoreSubscriptionEventDependencies;

  constructor(dependencies: ApplyStoreSubscriptionEventDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(event: ApplyStoreSubscriptionEventCommand): Promise<void> {
    // 처리하지 않는 이벤트(대시보드 TEST 등)는 우리 사용자가 아닐 수 있어 사용자를 찾기 전에 닫는다
    if (event.kind === "IGNORED") {
      this.#dependencies.logger.log({
        event: SubscriptionLogEvent.WEBHOOK_IGNORED,
        eventType: event.providerEventType,
        eventId: event.providerEventId,
      });
      return;
    }
    this.#dependencies.logger.log({
      event: SubscriptionLogEvent.WEBHOOK_STARTED,
      eventKind: event.kind,
      eventId: event.providerEventId,
      environment: event.environment ?? "UNKNOWN",
    });
    await this.#guard(event, async () => {
      const outcome =
        event.kind === "TRANSFERRED"
          ? await this.#dependencies.transferSubscriptions.execute(event)
          : await this.#dependencies.applySubscriptionChainEvent.execute(event);
      await this.#settle(event, outcome);
    });
  }

  // 영구 실패는 보고하고 받은 것으로 닫고, 잠금 경합(429)과 일시 실패(5xx)는 던져 공급자가 다시 보내게 한다
  async #guard(event: StoreSubscriptionEvent, run: () => Promise<void>): Promise<void> {
    try {
      await run();
    } catch (error) {
      if (isWebhookLockContended(error)) {
        this.#dependencies.logger.warn({ event: SubscriptionLogEvent.WEBHOOK_LOCK_CONTENDED });
        throw error;
      }
      const isRetryable = !isPermanentWebhookFailure(error);
      this.#dependencies.logger.error({
        event: SubscriptionLogEvent.WEBHOOK_FAILED,
        eventKind: event.kind,
        isRetryable,
        errorCode: error instanceof ErrorCodedException ? error.errorCode : undefined,
        errorType: toErrorType(error),
      });
      if (isRetryable) {
        throw error;
      }
      this.#dependencies.notifier.reportWebhookFailure(error, failureContextOf(event));
    }
  }

  async #settle(
    event: StoreSubscriptionEvent,
    outcome: SubscriptionEventOutcomeReadModel,
  ): Promise<void> {
    const { logger, notifier } = this.#dependencies;
    if (outcome.status === "duplicate") {
      logger.debug({
        event: SubscriptionLogEvent.WEBHOOK_DUPLICATE,
        eventKind: event.kind,
        userId: outcome.userId.value,
        eventId: event.providerEventId,
      });
      return;
    }
    if (outcome.status === "unchanged") {
      logger.debug({
        event: SubscriptionLogEvent.WEBHOOK_NO_CHANGE,
        eventKind: event.kind,
        userId: outcome.userId.value,
      });
      return;
    }
    if (!(await this.#invalidateCaches(event, outcome.affectedUserIds))) {
      return;
    }
    notifier.notifySubscriptionEvent(outcome.payload);
    logger.log({
      event: SubscriptionLogEvent.WEBHOOK_COMPLETED,
      eventKind: event.kind,
      userId: outcome.userId.value,
      environment: event.environment ?? "UNKNOWN",
    });
  }

  // 반영은 이미 커밋됐다. 다시 받아도 처리 원장이 막아 효과를 되풀이하지 못하므로 보고하고 받은 것으로 닫는다
  async #invalidateCaches(
    event: StoreSubscriptionEvent,
    userIds: readonly UserId[],
  ): Promise<boolean> {
    try {
      await Promise.all(userIds.map((userId) => this.#dependencies.cache.invalidate(userId)));
      return true;
    } catch (error) {
      this.#dependencies.notifier.reportWebhookFailure(error, failureContextOf(event));
      this.#dependencies.logger.error({
        event: SubscriptionLogEvent.WEBHOOK_FAILED,
        eventKind: event.kind,
        isRetryable: false,
        errorType: toErrorType(error),
      });
      return false;
    }
  }
}
