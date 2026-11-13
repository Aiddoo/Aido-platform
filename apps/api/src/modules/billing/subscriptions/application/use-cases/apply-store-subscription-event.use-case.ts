import { ErrorCode } from "@aido/api/errors";
import { sortBy, uniq, uniqBy } from "es-toolkit";
import { match } from "ts-pattern";

import type { UserMutationLockPort } from "#api/modules/identity/users/identity-users.public";
import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { toIsoString } from "#api/shared/domain/time/instant";

import type { PremiumAccessCachePort } from "../../../premium-grants/application/ports/premium-access-cache.port.js";
import type { UserSubscriptionProjection } from "../../../premium-grants/application/ports/user-subscription-projection.repository.port.js";
import type { ProjectPremiumAccessUseCase } from "../../../premium-grants/application/use-cases/project-premium-access.use-case.js";
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
import { Subscription } from "../../domain/subscription.aggregate.js";
import type { StoreSubscriptionEventKind } from "../../domain/subscriptions.constants.js";
import type { StoreSubscriptionReconcileSchedulerPort } from "../ports/store-subscription-reconcile-scheduler.port.js";
import type {
  StoreSubscriptionEventFailureContext,
  SubscriptionEventNotifierPort,
} from "../ports/subscription-event-notifier.port.js";
import type { SubscriptionEventReceiptRepositoryPort } from "../ports/subscription-event-receipt.repository.port.js";
import type {
  SubscriptionUser,
  SubscriptionUserReaderPort,
} from "../ports/subscription-user.reader.port.js";
import type { SubscriptionWebhookLockPort } from "../ports/subscription-webhook-lock.port.js";
import type { SubscriptionRepositoryPort } from "../ports/subscription.repository.port.js";
import type { SubscriptionEventPayload } from "../read-models/subscription-event-payload.read-model.js";
import {
  baseEventPayload,
  periodTypeAfter,
  premiumAccessSummaryOf,
  transferEventPayload,
} from "../subscription-event-payload.mapper.js";
import {
  subscriptionChainUnresolved,
  subscriptionUserNotFound,
  subscriptionWebhookLockContended,
} from "../subscriptions.errors.js";
import { SubscriptionLogEvent } from "../subscriptions.log-events.js";

type ProcessedChainEvent = Exclude<StoreSubscriptionChainEvent, { kind: "IGNORED" }>;
type Instant = Temporal.Instant;

export type ApplyStoreSubscriptionEventCommand = StoreSubscriptionEvent;

export interface ApplyStoreSubscriptionEventDependencies {
  readonly subscriptionRepository: SubscriptionRepositoryPort;
  readonly subscriptionUserReader: Pick<SubscriptionUserReaderPort, "findByAppUserId">;
  readonly receiptRepository: SubscriptionEventReceiptRepositoryPort;
  readonly userLock: Pick<UserMutationLockPort, "lockById">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly cache: PremiumAccessCachePort;
  readonly notifier: SubscriptionEventNotifierPort;
  readonly webhookLock: SubscriptionWebhookLockPort;
  readonly projectPremiumAccess: Pick<ProjectPremiumAccessUseCase, "execute">;
  readonly reconcileScheduler: StoreSubscriptionReconcileSchedulerPort;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

interface SubscriptionTransition {
  readonly projection: UserSubscriptionProjection;
  readonly payload: SubscriptionEventPayload;
  /** 이벤트가 행과 다른 만료 시각을 알려 주면 보상 기간 판단에 그 값을 쓴다. 비우면 행의 값이다. */
  readonly chainExpiresAt?: Instant;
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
  return { ...payload, premium: premiumAccessSummaryOf(access) };
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

function requireInstant(value: Instant | undefined, kind: string, reason: string): Instant {
  if (value == null) {
    throw subscriptionChainUnresolved({ reason, eventType: kind });
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
        this.#dependencies.logger.warn({ event: SubscriptionLogEvent.WEBHOOK_LOCK_CONTENDED });
        throw error;
      }
      const isRetryable = !isPermanentFailure(error);
      this.#dependencies.logger.error({
        event: SubscriptionLogEvent.WEBHOOK_FAILED,
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
      await Promise.all(
        userIds.map((userId) => this.#dependencies.cache.invalidate(UserId.reconstitute(userId))),
      );
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

  // 영구 실패는 공급자가 다시 보내지 않으므로 스토어 상태를 다시 읽어 스스로 맞춘다
  async #scheduleRecovery(userId: string): Promise<void> {
    try {
      await this.#dependencies.reconcileScheduler.schedule(
        UserId.reconstitute(userId),
        this.#dependencies.clock.now(),
      );
    } catch (error) {
      this.#dependencies.logger.warn({
        event: SubscriptionLogEvent.RECONCILE_FAILED,
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
    const {
      subscriptionRepository,
      subscriptionUserReader,
      webhookLock,
      unitOfWork,
      userLock,
      clock,
    } = this.#dependencies;
    const receiverAppUserIds = uniq(event.receivers);
    const lockKey = receiverAppUserIds[0] ?? "";
    this.#logStarted(event);
    const release = await webhookLock.acquire(lockKey);
    if (release == null) {
      throw subscriptionWebhookLockContended(lockKey);
    }

    try {
      const receiver = await this.#findFirstUser(receiverAppUserIds);
      if (receiver == null) {
        throw subscriptionUserNotFound(lockKey);
      }
      const previousOwners = uniqBy(
        (
          await Promise.all(
            uniq(event.transferredFrom).map((appUserId) =>
              subscriptionUserReader.findByAppUserId(appUserId),
            ),
          )
        ).flatMap((owner) => (owner == null || owner.id === receiver.id ? [] : [owner])),
        (owner) => owner.id,
      );
      const result = await unitOfWork.run(async () => {
        // 넘겨준·넘겨받은 사용자를 id 순으로 잠가 반대 방향 이전과 교착하지 않는다
        for (const user of sortBy([receiver, ...previousOwners], [(user) => user.id])) {
          if (!(await userLock.lockById(UserId.reconstitute(user.id))) && user.id === receiver.id) {
            throw subscriptionUserNotFound(lockKey);
          }
        }
        if (!(await this.#claimReceipt(event))) {
          return null;
        }
        const now = clock.now();
        const receiverId = UserId.reconstitute(receiver.id);
        for (const owner of previousOwners) {
          await subscriptionRepository.takeOverChains(
            UserId.reconstitute(owner.id),
            receiverId,
            now,
          );
        }
        // 옮겨 받은 스토어 행과 보상 기간을 함께 보고 다시 계산해 보상 기간이 구독을 덮지 않게 한다
        const { access } = await this.#dependencies.projectPremiumAccess.execute({
          userId: receiverId,
          now,
        });
        for (const owner of previousOwners) {
          await this.#dependencies.projectPremiumAccess.execute({
            userId: UserId.reconstitute(owner.id),
            now,
          });
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
      const user = await this.#dependencies.subscriptionUserReader.findByAppUserId(appUserId);
      if (user != null) {
        return user;
      }
    }
    return null;
  }

  async #process(event: ProcessedChainEvent): Promise<void> {
    const { subscriptionUserReader, webhookLock } = this.#dependencies;
    this.#logStarted(event);
    const release = await webhookLock.acquire(event.appUserId);
    if (release == null) {
      throw subscriptionWebhookLockContended(event.appUserId);
    }

    try {
      const user = await subscriptionUserReader.findByAppUserId(event.appUserId);
      if (user == null) {
        throw subscriptionUserNotFound(event.appUserId);
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
          event: SubscriptionLogEvent.WEBHOOK_NO_CHANGE,
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
    const { subscriptionRepository, userLock, clock } = this.#dependencies;
    return this.#dependencies.unitOfWork.run(async () => {
      const userId = UserId.reconstitute(user.id);
      if (!(await userLock.lockById(userId))) {
        throw subscriptionUserNotFound(event.appUserId);
      }
      // 처리 원장은 업무 변경과 함께 커밋한다. 실패한 트랜잭션은 다시 처리할 수 있다
      if (!(await this.#claimReceipt(event))) {
        this.#logDuplicate(event, user.id);
        return null;
      }
      // 이벤트는 신호다. 늦거나 빠진 이벤트로 어긋난 상태를 스토어에서 다시 읽어 맞추도록 함께 커밋한다
      await this.#dependencies.reconcileScheduler.schedule(userId, clock.now());
      const subscription =
        event.storeSubscriptionId != null && event.storeSubscriptionId !== ""
          ? await subscriptionRepository.findByStoreSubscriptionId(
              StoreSubscriptionId.create(event.storeSubscriptionId),
            )
          : null;
      // 배포 이전 마지막 이벤트 ID도 중복 처리하지 않는다
      if (event.providerEventId != null && subscription?.wasProcessedWith(event.providerEventId)) {
        return null;
      }
      const payload = await this.#applyEvent(user, event, subscription);
      if (payload != null && event.kind === "BILLING_ISSUE") {
        await this.#dependencies.notifier.recordBillingIssue(userId, clock.now());
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
      processedAt: this.#dependencies.clock.now(),
      environment: event.environment,
    });
  }

  async #applyEvent(
    user: SubscriptionUser,
    event: ProcessedChainEvent,
    subscription: Subscription | null,
  ): Promise<SubscriptionEventPayload | null> {
    const { subscriptionRepository, clock } = this.#dependencies;
    const storeSubscriptionId = StoreSubscriptionId.create(event.storeSubscriptionId);
    if (event.kind === "BILLING_ISSUE") {
      return this.#enterBillingGrace(user, event, storeSubscriptionId, subscription);
    }
    if (event.kind === "STARTED") {
      return this.#createSubscription(user, event, storeSubscriptionId, subscription);
    }

    // 갱신이 요구하는 시각 오류는 구독 없음 오류보다 우선한다
    const renewalExpiresAt =
      event.kind === "RENEWED"
        ? requireInstant(event.periodEndsAt, event.kind, "Missing period end for renewal")
        : undefined;
    if (subscription == null && event.kind === "RENEWED" && renewalExpiresAt != null) {
      return this.#adoptRenewedChain(user, event, storeSubscriptionId, renewalExpiresAt);
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

    // 체인의 이벤트가 다른 사용자로 오면 구매가 옮겨 간 것이다. 행의 소유자를 이벤트 사용자로 맞춰
    // 프리미엄 판단이 User projection 대신 행 자체를 믿을 수 있게 한다
    const userId = UserId.reconstitute(user.id);
    const now = clock.now();
    await subscriptionRepository.claimChain(storeSubscriptionId, userId, now);
    const transition = this.#planTransition({
      user,
      event,
      storeSubscriptionId,
      subscription,
      renewalExpiresAt,
      now,
    });
    if (transition == null) {
      return null;
    }
    await subscriptionRepository.save(subscription);
    const access = await this.#projectUser(userId, storeSubscriptionId, transition.projection, {
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
    const now = this.#dependencies.clock.now();
    if (
      subscription == null ||
      !subscription.enterBillingGrace({
        gracePeriodEndsAt: event.gracePeriodEndsAt,
        periodExpiresAt: event.periodEndsAt ?? null,
        now,
        ...(event.providerEventId != null && { eventId: event.providerEventId }),
      })
    ) {
      return payload;
    }
    const { subscriptionRepository } = this.#dependencies;
    const userId = UserId.reconstitute(user.id);
    await subscriptionRepository.claimChain(storeSubscriptionId, userId, now);
    await subscriptionRepository.save(subscription);
    const access = await this.#projectUser(
      userId,
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
    expiresAt: Instant,
  ): Promise<SubscriptionEventPayload> {
    const { subscriptionRepository, clock } = this.#dependencies;
    const now = clock.now();
    const userId = UserId.reconstitute(user.id);
    await subscriptionRepository.save(
      Subscription.create({
        id: await subscriptionRepository.nextId(),
        userId,
        provider: event.provider,
        storeSubscriptionId,
        productId: event.productId,
        startedAt: event.startedAt ?? now,
        expiresAt,
        lastProcessedEventId: event.providerEventId ?? null,
        environment: event.environment,
        periodType: periodTypeAfter(event) ?? null,
        now,
      }),
    );
    this.#dependencies.logger.log({
      event: SubscriptionLogEvent.SUBSCRIPTION_CHAIN_ADOPTED,
      eventKind: event.kind,
      userId: user.id,
    });
    const access = await this.#projectUser(userId, storeSubscriptionId, {
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: expiresAt,
    });
    return withPremium(
      {
        ...baseEventPayload(user, event, storeSubscriptionId.value),
        expiresAt: toIsoString(expiresAt),
      },
      access,
    );
  }

  // 스토어 상태가 바뀌면 보상 기간을 함께 보고 User의 구독 projection을 다시 계산한다
  async #projectUser(
    userId: UserId,
    eventChainId: StoreSubscriptionId,
    requested: UserSubscriptionProjection,
    chainState: Omit<StoreEventChainState, "storeSubscriptionId"> = {
      status: requested.subscriptionStatus,
      expiresAt: requested.subscriptionExpiresAt,
    },
  ): Promise<PremiumAccess> {
    const { access } = await this.#dependencies.projectPremiumAccess.execute({
      userId,
      now: this.#dependencies.clock.now(),
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
    const { subscriptionRepository, clock } = this.#dependencies;
    const userId = UserId.reconstitute(user.id);
    const isFirstPurchase = !(await subscriptionRepository.existsByUserId(userId));
    await subscriptionRepository.save(
      Subscription.create({
        id: await subscriptionRepository.nextId(),
        userId,
        provider: event.provider,
        storeSubscriptionId,
        productId: event.productId,
        startedAt,
        expiresAt,
        lastProcessedEventId: event.providerEventId ?? null,
        // SANDBOX 구매도 프리미엄을 준다. App Review가 운영 서버에서 sandbox로 결제를 확인한다
        environment: event.environment,
        periodType: periodTypeAfter(event) ?? null,
        now: clock.now(),
      }),
    );
    const access = await this.#projectUser(userId, storeSubscriptionId, {
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: expiresAt,
    });
    return {
      ...withPremium(baseEventPayload(user, event, storeSubscriptionId.value), access),
      isFirstPurchase,
      purchasedAt: toIsoString(startedAt),
      expiresAt: toIsoString(expiresAt),
    };
  }

  #planTransition(params: {
    readonly user: SubscriptionUser;
    readonly event: Exclude<
      ProcessedChainEvent,
      { kind: Extract<StoreSubscriptionEventKind, "STARTED" | "BILLING_ISSUE"> }
    >;
    readonly storeSubscriptionId: StoreSubscriptionId;
    readonly subscription: Subscription;
    readonly renewalExpiresAt: Instant | undefined;
    readonly now: Instant;
  }): SubscriptionTransition | null {
    const { user, event, storeSubscriptionId, subscription, renewalExpiresAt, now } = params;
    const payload = baseEventPayload(user, event, storeSubscriptionId.value);
    const expiresAt = event.periodEndsAt;
    const eventId = event.providerEventId;
    const eventIdField = eventId == null ? {} : { eventId };
    const activeProjection: UserSubscriptionProjection = {
      subscriptionStatus: "ACTIVE",
      ...(expiresAt != null && { subscriptionExpiresAt: expiresAt }),
    };
    return match(event)
      .returnType<SubscriptionTransition | null>()
      .with({ kind: "RENEWED" }, (renewed) => {
        const periodType = periodTypeAfter(renewed);
        if (
          renewalExpiresAt == null ||
          !subscription.renew({
            expiresAt: renewalExpiresAt,
            now,
            ...eventIdField,
            ...(periodType != null && { periodType }),
            productId: renewed.productId,
          })
        ) {
          return null;
        }
        return {
          projection: { subscriptionStatus: "ACTIVE", subscriptionExpiresAt: renewalExpiresAt },
          payload: { ...payload, expiresAt: toIsoString(renewalExpiresAt) },
        };
      })
      .with({ kind: "CANCELLED" }, { kind: "REFUNDED" }, (cancelled) => {
        const refunded = cancelled.kind === "REFUNDED";
        const cancellationExpiresAt = expiresAt ?? subscription.expiresAt;
        if (
          !subscription.cancel({
            refunded,
            now,
            ...eventIdField,
            eventPeriodType: cancelled.periodKind,
            ...(expiresAt != null && { eventExpiresAt: expiresAt }),
          })
        ) {
          return null;
        }
        return {
          projection: refunded
            ? { subscriptionStatus: "FREE", subscriptionExpiresAt: null }
            : {
                subscriptionStatus: resolveCancellationUserStatus(cancellationExpiresAt, now),
                subscriptionExpiresAt: cancellationExpiresAt,
              },
          // 해지는 이벤트에 만료 시각이 없어도 행이 아는 이용 종료 시각을 알린다
          payload: { ...payload, expiresAt: toIsoString(cancellationExpiresAt) },
          chainExpiresAt: cancellationExpiresAt,
        };
      })
      .with({ kind: "UNCANCELLED" }, () =>
        subscription.uncancel({
          ...(expiresAt != null && { expiresAt }),
          now,
          ...eventIdField,
        })
          ? { projection: activeProjection, payload }
          : null,
      )
      .with({ kind: "EXPIRED" }, () => {
        if (!subscription.expire({ expirationAt: expiresAt ?? null, now, ...eventIdField })) {
          return null;
        }
        return {
          projection: { subscriptionStatus: "FREE", subscriptionExpiresAt: null },
          payload,
        };
      })
      .with({ kind: "PRODUCT_CHANGE_SCHEDULED" }, (changed) =>
        subscription.reserveProductChange({
          ...(changed.newProductId != null && { newProductId: changed.newProductId }),
          ...(expiresAt != null && { expiresAt }),
          now,
          ...eventIdField,
        })
          ? { projection: activeProjection, payload }
          : null,
      )
      .with({ kind: "EXTENDED" }, () =>
        subscription.extend({
          ...(expiresAt != null && { expiresAt }),
          now,
          ...eventIdField,
        })
          ? { projection: activeProjection, payload }
          : null,
      )
      .exhaustive();
  }

  #logStarted(event: StoreSubscriptionEvent): void {
    this.#dependencies.logger.log({
      event: SubscriptionLogEvent.WEBHOOK_STARTED,
      eventKind: event.kind,
      eventId: event.providerEventId,
      environment: event.environment ?? "UNKNOWN",
    });
  }

  #logDuplicate(event: StoreSubscriptionEvent, userId: string): void {
    this.#dependencies.logger.debug({
      event: SubscriptionLogEvent.WEBHOOK_DUPLICATE,
      eventKind: event.kind,
      userId,
      eventId: event.providerEventId,
    });
  }

  #logCompleted(event: StoreSubscriptionEvent, userId: string): void {
    this.#dependencies.logger.log({
      event: SubscriptionLogEvent.WEBHOOK_COMPLETED,
      eventKind: event.kind,
      userId,
      environment: event.environment ?? "UNKNOWN",
    });
  }
}
