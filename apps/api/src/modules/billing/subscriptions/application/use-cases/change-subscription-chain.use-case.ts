import type { ProjectPremiumAccessUseCase } from "#api/modules/billing/premium-grants/billing-premium-grants.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { toIsoString } from "#api/shared/domain/time/instant";

import { StoreSubscriptionId } from "../../domain/store-subscription-id.vo.js";
import {
  providerEventIdOf,
  type StoreSubscriptionChainEvent,
  type SubscriptionBillingIssueEvent,
  type SubscriptionRenewedEvent,
  type SubscriptionStartedEvent,
} from "../../domain/store-subscription.event.js";
import {
  applySubscriptionChange,
  type SubscriptionChangeEvent,
  type SubscriptionStatusFallback,
} from "../../domain/subscription-change.domain-service.js";
import { periodTypeAfter } from "../../domain/subscription-lifecycle.domain-service.js";
import { Subscription } from "../../domain/subscription.aggregate.js";
import type { SubscriptionRepositoryPort } from "../ports/subscription.repository.port.js";
import {
  baseEventPayload,
  premiumAccessSummaryOf,
  type SubscriptionEventPayloadReadModel,
} from "../read-models/subscription-event-payload.read-model.js";
import type { SubscriptionUserReadModel } from "../read-models/subscription-user.read-model.js";
import { subscriptionChainUnresolved } from "../subscriptions.errors.js";
import { SubscriptionLogEvent } from "../subscriptions.log-events.js";

type Instant = Temporal.Instant;

export interface ChangeSubscriptionChainCommand {
  readonly user: SubscriptionUserReadModel;
  readonly event: Exclude<StoreSubscriptionChainEvent, { kind: "IGNORED" }>;
  /** 이벤트의 체인 키로 읽은 행. 없으면 null이다. */
  readonly subscription: Subscription | null;
}

export interface ChangeSubscriptionChainDependencies {
  readonly subscriptionRepository: Pick<
    SubscriptionRepositoryPort,
    "nextId" | "existsByUserId" | "save"
  >;
  readonly projectPremiumAccess: Pick<ProjectPremiumAccessUseCase, "execute">;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

/** 저장한 체인 행과 보상 기간을 함께 보고 프리미엄을 다시 계산할 값 */
interface SavedSubscriptionChange {
  readonly subscription: Subscription;
  readonly fallback: SubscriptionStatusFallback;
  /** 이벤트가 행과 다른 이용 종료 시각을 알려 주면 보상 기간 판단에 그 값을 쓴다. 비우면 행의 값이다. */
  readonly chainExpiresAt?: Instant;
  readonly payload: SubscriptionEventPayloadReadModel;
}

function requireInstant(value: Instant | undefined, kind: string, reason: string): Instant {
  if (value == null) {
    throw subscriptionChainUnresolved({ reason, eventType: kind });
  }
  return value;
}

/**
 * 체인 이벤트 하나를 체인 행에 반영하고 보상 기간과 함께 프리미엄을 다시 계산한다. 반영한 운영 알림 값을 돌려주고
 * 바꿀 것이 없으면 null이다. 호출자가 UoW·웹훅 잠금·사용자 잠금·처리 원장을 소유한다.
 */
export class ChangeSubscriptionChainUseCase {
  readonly #dependencies: ChangeSubscriptionChainDependencies;

  constructor(dependencies: ChangeSubscriptionChainDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    command: ChangeSubscriptionChainCommand,
  ): Promise<SubscriptionEventPayloadReadModel | null> {
    const { user, event, subscription } = command;
    const storeSubscriptionId = StoreSubscriptionId.create(event.storeSubscriptionId);
    if (event.kind === "BILLING_ISSUE") {
      return this.#enterBillingGrace({ user, event, storeSubscriptionId, subscription });
    }
    if (event.kind === "STARTED") {
      return this.#start({ user, event, storeSubscriptionId, existing: subscription });
    }
    // 갱신이 요구하는 시각 오류는 구독 없음 오류보다 우선한다
    const renewalExpiresAt =
      event.kind === "RENEWED"
        ? requireInstant(event.periodEndsAt, event.kind, "Missing period end for renewal")
        : undefined;
    if (subscription == null && event.kind === "RENEWED" && renewalExpiresAt != null) {
      return this.#adoptRenewedChain({
        user,
        event,
        storeSubscriptionId,
        expiresAt: renewalExpiresAt,
      });
    }
    if (subscription == null) {
      throw subscriptionChainUnresolved(
        event.kind === "RENEWED"
          ? {
              reason: `Subscription not found for renewal: ${storeSubscriptionId.value}`,
              eventType: event.kind,
            }
          : { reason: `Subscription not found: ${storeSubscriptionId.value}` },
      );
    }
    return this.#change({ user, event, subscription, renewalExpiresAt });
  }

  /**
   * 결제 실패. 스토어가 결제를 다시 시도하는 결제 유예 동안 엔타이틀먼트가 남으므로 그 끝을 행에 남겨
   * 프리미엄과 쌓아 둔 보상의 시작을 미룬다. 행이 없거나 바꿀 것이 없어도 알림은 보낸다.
   */
  async #enterBillingGrace(params: {
    readonly user: SubscriptionUserReadModel;
    readonly event: SubscriptionBillingIssueEvent;
    readonly storeSubscriptionId: StoreSubscriptionId;
    readonly subscription: Subscription | null;
  }): Promise<SubscriptionEventPayloadReadModel> {
    const { user, event, storeSubscriptionId, subscription } = params;
    const payload = baseEventPayload(user, event, storeSubscriptionId.value);
    const now = this.#dependencies.clock.now();
    const eventId = providerEventIdOf(event);
    if (
      subscription == null ||
      !subscription.enterBillingGrace({
        gracePeriodEndsAt: event.gracePeriodEndsAt,
        periodExpiresAt: event.periodEndsAt ?? null,
        now,
        ...(eventId != null && { eventId }),
      })
    ) {
      return payload;
    }
    subscription.transferTo(user.id, now);
    await this.#dependencies.subscriptionRepository.save(subscription);
    return this.#projectPremium(user.id, {
      subscription,
      fallback: { subscriptionStatus: "ACTIVE", subscriptionExpiresAt: subscription.expiresAt },
      payload,
    });
  }

  async #start(params: {
    readonly user: SubscriptionUserReadModel;
    readonly event: SubscriptionStartedEvent;
    readonly storeSubscriptionId: StoreSubscriptionId;
    readonly existing: Subscription | null;
  }): Promise<SubscriptionEventPayloadReadModel | null> {
    const { user, event, storeSubscriptionId, existing } = params;
    const startedAt = requireInstant(
      event.startedAt,
      event.kind,
      "Missing start time for purchase",
    );
    const expiresAt = requireInstant(
      event.periodEndsAt,
      event.kind,
      "Missing period end for purchase",
    );
    if (existing != null) {
      return null;
    }
    const isFirstPurchase = !(await this.#dependencies.subscriptionRepository.existsByUserId(
      user.id,
    ));
    // SANDBOX 구매도 프리미엄을 준다. App Review가 운영 서버에서 sandbox로 결제를 확인한다
    const subscription = await this.#createChain({
      user,
      event,
      storeSubscriptionId,
      startedAt,
      expiresAt,
    });
    return this.#projectPremium(user.id, {
      subscription,
      fallback: { subscriptionStatus: "ACTIVE", subscriptionExpiresAt: expiresAt },
      payload: {
        ...baseEventPayload(user, event, storeSubscriptionId.value),
        isFirstPurchase,
        purchasedAt: toIsoString(startedAt),
        expiresAt: toIsoString(expiresAt),
      },
    });
  }

  /**
   * 행이 없는 체인의 갱신. 탈퇴로 행이 함께 지워진 계정의 구매를 새 계정이 복원하면 이전으로 옮길 행이 없고,
   * 이전 이벤트에는 상품·만료 시각이 없다. 갱신 이벤트로 체인 행을 만들어 이어 받는다.
   */
  async #adoptRenewedChain(params: {
    readonly user: SubscriptionUserReadModel;
    readonly event: SubscriptionRenewedEvent;
    readonly storeSubscriptionId: StoreSubscriptionId;
    readonly expiresAt: Instant;
  }): Promise<SubscriptionEventPayloadReadModel> {
    const { user, event, storeSubscriptionId, expiresAt } = params;
    const subscription = await this.#createChain({
      user,
      event,
      storeSubscriptionId,
      startedAt: event.startedAt ?? this.#dependencies.clock.now(),
      expiresAt,
    });
    this.#dependencies.logger.log({
      event: SubscriptionLogEvent.CHAIN_ADOPTED,
      eventKind: event.kind,
      userId: user.id.value,
    });
    return this.#projectPremium(user.id, {
      subscription,
      fallback: { subscriptionStatus: "ACTIVE", subscriptionExpiresAt: expiresAt },
      payload: {
        ...baseEventPayload(user, event, storeSubscriptionId.value),
        expiresAt: toIsoString(expiresAt),
      },
    });
  }

  async #createChain(params: {
    readonly user: SubscriptionUserReadModel;
    readonly event: SubscriptionStartedEvent | SubscriptionRenewedEvent;
    readonly storeSubscriptionId: StoreSubscriptionId;
    readonly startedAt: Instant;
    readonly expiresAt: Instant;
  }): Promise<Subscription> {
    const { subscriptionRepository, clock } = this.#dependencies;
    const { user, event, storeSubscriptionId, startedAt, expiresAt } = params;
    const subscription = Subscription.create({
      id: await subscriptionRepository.nextId(),
      userId: user.id,
      storeSubscriptionId,
      productId: event.productId,
      startedAt,
      expiresAt,
      lastProcessedEventId: providerEventIdOf(event) ?? null,
      environment: event.environment,
      periodType: periodTypeAfter(event) ?? null,
      now: clock.now(),
    });
    await subscriptionRepository.save(subscription);
    return subscription;
  }

  // 체인의 이벤트가 다른 사용자로 오면 구매가 옮겨 간 것이다. 행의 소유자를 이벤트 사용자로 맞춰
  // 프리미엄 판단이 User projection 대신 행 자체를 믿을 수 있게 한다
  async #change(params: {
    readonly user: SubscriptionUserReadModel;
    readonly event: SubscriptionChangeEvent;
    readonly subscription: Subscription;
    readonly renewalExpiresAt: Instant | undefined;
  }): Promise<SubscriptionEventPayloadReadModel | null> {
    const { user, event, subscription, renewalExpiresAt } = params;
    const now = this.#dependencies.clock.now();
    const isTransferred = subscription.transferTo(user.id, now);
    const change = applySubscriptionChange({
      subscription,
      event,
      renewalExpiresAt,
      eventId: providerEventIdOf(event),
      now,
    });
    // 상태가 그대로인 늦은 이벤트여도 옮겨 간 소유자는 남긴다
    if (change != null || isTransferred) {
      await this.#dependencies.subscriptionRepository.save(subscription);
    }
    if (change == null) {
      return null;
    }
    const reportedExpiresAt = change.reportedExpiresAt;
    return this.#projectPremium(user.id, {
      subscription,
      fallback: change.fallback,
      ...(reportedExpiresAt != null && { chainExpiresAt: reportedExpiresAt }),
      payload: {
        ...baseEventPayload(user, event, subscription.storeSubscriptionId.value),
        ...(reportedExpiresAt != null && { expiresAt: toIsoString(reportedExpiresAt) }),
      },
    });
  }

  // 스토어 상태가 바뀌면 보상 기간을 함께 보고 User의 구독 projection을 다시 계산한다
  async #projectPremium(
    userId: UserId,
    change: SavedSubscriptionChange,
  ): Promise<SubscriptionEventPayloadReadModel> {
    const { subscription } = change;
    const { access } = await this.#dependencies.projectPremiumAccess.execute({
      userId,
      now: this.#dependencies.clock.now(),
      // 만료는 행을 지우지 않고 스토어가 끝난 시각을 남겨 쌓아 둔 보상이 그 시각부터 이어지게 한다
      eventChain: {
        storeSubscriptionId: subscription.storeSubscriptionId.value,
        status: subscription.status,
        expiresAt: change.chainExpiresAt ?? subscription.expiresAt,
        gracePeriodEndsAt: subscription.gracePeriodEndsAt,
        periodType: subscription.periodType,
      },
      fallback: change.fallback,
    });
    return { ...change.payload, premium: premiumAccessSummaryOf(access) };
  }
}
