import type { PushDispatchSkipReason } from "@aido/api/vocabulary";

// Provider accept와 DB finalize 사이에는 외부 트랜잭션 경계가 있어 전달 보장은 at-least-once다. 재시도 때 stale worker가 상태를 덮어쓰지 않도록 모든 상태 변경이 claimed fence와 UOW를 거치는지 고정한다
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { StubMarketingPushOptOutToken } from "#test/doubles/notification/stub-marketing-push-opt-out-token";
import {
  type PushDeliveryLifecycleOperation,
  StubPushDeliveryLifecycleRepository,
} from "#test/doubles/notification/stub-push-delivery-lifecycle.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createNotificationDeliveryPreferenceFixture } from "#test/fixtures/notification/notification-delivery-preference.fixture";
import { createNotificationDraftFixture } from "#test/fixtures/notification/notification.fixture";

import type { CreateNotificationData } from "../../../inbox/application/ports/notification-draft.port.js";
import { InMemoryPushRateLimiterAdapter } from "../../infrastructure/adapters/in-memory-push-rate-limiter.adapter.js";
import { PushNotificationPayloadMapper } from "../../infrastructure/adapters/push-notification-payload.mapper.js";
import type { ClaimedPushDelivery } from "../ports/push-delivery-lifecycle.repository.port.js";
import type {
  BatchPushNotificationPayload,
  PushNotificationPayloadPort,
} from "../ports/push-notification-payload.port.js";
import type { PushPayload } from "../ports/push-provider.port.js";
import { RetryablePushProviderTransportError } from "../ports/push-provider.port.js";
import type { PushRateLimiterPort } from "../ports/push-rate-limiter.port.js";
import { PushDeliveryRateLimitReservationConflictError } from "../push-delivery-rate-limit-reservation-conflict.errors.js";
import type { DeliverPushNotificationsInput } from "../read-models/push-delivery.read-model.js";
import { DeliverPushNotificationsUseCase } from "./deliver-push-notifications.use-case.js";
import type {
  BatchPushNotificationDeliveryResult,
  DispatchPushNotificationUseCase,
  PreparedBatchPushDelivery,
  SinglePushNotificationDeliveryResult,
} from "./dispatch-push-notification.use-case.js";
import type {
  BatchPushDeliveryRecipient,
  EvaluatePushDeliveryEligibilityUseCase,
  PushDeliveryEligibilityDecision,
  SinglePushDeliveryRecipient,
} from "./evaluate-push-delivery-eligibility.use-case.js";

const NOW = Temporal.Instant.from("2026-08-29T03:00:00.000Z");
const PROCESSING_JOB_ID = "push-delivery-job-20260829";
const LOCAL_DATE = "2026-08-29";
const LOCAL_DATE_CONTEXT = {
  timezone: "Asia/Seoul",
  localDate: Temporal.PlainDate.from("2026-08-29"),
};

type SingleEvaluateInput = Parameters<EvaluatePushDeliveryEligibilityUseCase["evaluateSingle"]>;
type BatchCandidate = {
  readonly data: CreateNotificationData;
  readonly rateLimitDispatchId: number;
};
type CreateSingleInput = Parameters<PushNotificationPayloadPort["createSingle"]>[0];
type DeliverSingleInput = Parameters<DispatchPushNotificationUseCase["deliverSingle"]>[0];

function createClaimedDelivery(input: {
  readonly dispatchId: number;
  readonly deliveryMode: ClaimedPushDelivery["deliveryMode"];
  readonly userId: string;
  readonly notificationId?: number;
  readonly force?: boolean;
  readonly publishAttempt?: number;
  readonly rateLimitReservation?: ClaimedPushDelivery["rateLimitReservation"];
  readonly dataOverrides?: Partial<CreateNotificationData>;
}): ClaimedPushDelivery {
  const force = input.force ?? false;
  return {
    fence: {
      dispatchId: input.dispatchId,
      publishAttempt: input.publishAttempt ?? 2,
      processingJobId: PROCESSING_JOB_ID,
      deliveryAttemptCount: 3,
    },
    deliveryMode: input.deliveryMode,
    force,
    rateLimitReservation: input.rateLimitReservation ?? { status: "pending" },
    item: {
      notificationId: input.notificationId ?? input.dispatchId + 1000,
      data: createNotificationDraftFixture({
        userId: input.userId,
        type: "FOLLOW_NEW",
        title: `${input.userId} title`,
        body: `${input.userId} body`,
        force,
        ...input.dataOverrides,
      }),
    },
  };
}

function createExecutionInput(
  claimed: readonly ClaimedPushDelivery[],
): DeliverPushNotificationsInput {
  return {
    processingJobId: PROCESSING_JOB_ID,
    processingJobAttempt: 1,
    publications: claimed.map(({ fence }) => ({
      dispatchId: fence.dispatchId,
      publishAttempt: fence.publishAttempt,
    })),
    isFinalAttempt: false,
  };
}

// 열린 트랜잭션 깊이를 세어 저장소 쓰기가 UOW 안에서 일어났는지 본다
class DepthTrackingUnitOfWork extends UnitOfWorkPort {
  depth = 0;
  runCount = 0;

  async run<T>(work: () => Promise<T>): Promise<T> {
    this.runCount += 1;
    this.depth += 1;
    try {
      return await work();
    } finally {
      this.depth -= 1;
    }
  }
}

// 사용자별로 정한 이유로만 건너뛰고 나머지는 발송 대상으로 둔다
class StubDeliveryEligibility implements Pick<
  EvaluatePushDeliveryEligibilityUseCase,
  | "evaluateBatchSettings"
  | "evaluateSingle"
  | "loadBatchRecipients"
  | "loadSingleRecipient"
  | "reserveBatch"
> {
  readonly singleSkipReasons = new Map<string, PushDispatchSkipReason>();
  readonly batchSettingsSkipReasons = new Map<string, PushDispatchSkipReason>();
  readonly rateLimitedUserIds = new Set<string>();
  // 정하면 배치 rate 예약을 이 limiter로 실제 판정한다
  rateLimiter: Pick<PushRateLimiterPort, "reserveBatch"> | null = null;
  readonly singleRecipientLoads: string[] = [];
  readonly singleEvaluations: SingleEvaluateInput[] = [];
  readonly batchRecipientLoads: string[][] = [];
  readonly batchSettingsCandidates: BatchCandidate[][] = [];
  reserveBatchCount = 0;
  readonly #callOrder: string[];

  constructor(callOrder: string[]) {
    this.#callOrder = callOrder;
  }

  async loadSingleRecipient(userId: string): Promise<SinglePushDeliveryRecipient> {
    this.#callOrder.push("loadSingleRecipient");
    this.singleRecipientLoads.push(userId);
    return {
      userId,
      timezone: "Asia/Seoul",
      localDate: LOCAL_DATE,
      preference: createNotificationDeliveryPreferenceFixture(),
    };
  }

  async evaluateSingle(
    ...input: SingleEvaluateInput
  ): Promise<PushDeliveryEligibilityDecision<CreateNotificationData>> {
    this.#callOrder.push("evaluateSingle");
    this.singleEvaluations.push(input);
    const [data] = input;
    const reason = this.singleSkipReasons.get(data.userId);
    return reason == null
      ? { status: "eligible", candidate: data }
      : { status: "skipped", candidate: data, reason };
  }

  async loadBatchRecipients(
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, BatchPushDeliveryRecipient>> {
    this.#callOrder.push("loadBatchRecipients");
    this.batchRecipientLoads.push([...userIds]);
    return new Map(
      userIds.map((userId) => [
        userId,
        {
          userId,
          timezone: "Asia/Seoul",
          localDate: LOCAL_DATE,
          preference: createNotificationDeliveryPreferenceFixture(),
          consent: { marketingPushAgreedAt: Temporal.Instant.from("2026-08-01T00:00:00.000Z") },
        },
      ]),
    );
  }

  evaluateBatchSettings<TCandidate extends BatchCandidate>(
    candidates: readonly TCandidate[],
  ): readonly PushDeliveryEligibilityDecision<TCandidate>[] {
    this.#callOrder.push("evaluateBatchSettings");
    this.batchSettingsCandidates.push([...candidates]);
    return candidates.map((candidate) => {
      const reason = this.batchSettingsSkipReasons.get(candidate.data.userId);
      return reason == null
        ? { status: "eligible", candidate }
        : { status: "skipped", candidate, reason };
    });
  }

  async reserveBatch<TCandidate extends BatchCandidate>(
    candidates: readonly TCandidate[],
  ): Promise<readonly PushDeliveryEligibilityDecision<TCandidate>[]> {
    this.#callOrder.push("reserveBatch");
    this.reserveBatchCount += 1;
    const limited =
      this.rateLimiter == null
        ? candidates.map((candidate) => this.rateLimitedUserIds.has(candidate.data.userId))
        : await this.rateLimiter.reserveBatch(
            candidates.map((candidate) => ({
              dispatchId: candidate.rateLimitDispatchId,
              userId: candidate.data.userId,
              engagementLocalDate: LOCAL_DATE,
            })),
          );
    return candidates.map((candidate, index) =>
      limited[index] === true
        ? { status: "skipped", candidate, reason: "RATE_LIMITED" }
        : { status: "eligible", candidate },
    );
  }
}

// 실제 payload mapper로 만들고 받은 입력만 남긴다
class RecordingPayloadFactory implements Pick<
  PushNotificationPayloadPort,
  "createBatch" | "createSingle"
> {
  readonly singleInputs: CreateSingleInput[] = [];
  readonly batchDispatchIds: number[] = [];
  readonly #mapper = new PushNotificationPayloadMapper({
    marketingOptOutTokens: new StubMarketingPushOptOutToken(),
  });
  readonly #callOrder: string[];

  constructor(callOrder: string[]) {
    this.#callOrder = callOrder;
  }

  createSingle(input: CreateSingleInput): Omit<PushPayload, "token"> {
    this.#callOrder.push("createSinglePayload");
    this.singleInputs.push(input);
    return this.#mapper.createSingle(input);
  }

  createBatch(input: CreateSingleInput): BatchPushNotificationPayload {
    this.#callOrder.push(`createBatchPayload:${input.dispatchId}`);
    this.batchDispatchIds.push(input.dispatchId);
    return this.#mapper.createBatch(input);
  }
}

// 토큰을 고르는 대신 사용자별로 정한 결과를 준다. 받은 payload와 provider 배치 수를 남긴다
class StubPushDelivery implements Pick<
  DispatchPushNotificationUseCase,
  "deliverSingle" | "prepareBatchDelivery" | "sendPreparedBatch"
> {
  readonly singleSkipReasons = new Map<string, PushDispatchSkipReason>();
  readonly batchNoTokenUserIds = new Set<string>();
  sendError: unknown = null;
  readonly deliverSingleInputs: DeliverSingleInput[] = [];
  readonly preparedPayloads: BatchPushNotificationPayload[][] = [];
  sentBatchCount = 0;
  readonly #callOrder: string[];

  constructor(callOrder: string[]) {
    this.#callOrder = callOrder;
  }

  async deliverSingle(input: DeliverSingleInput): Promise<SinglePushNotificationDeliveryResult> {
    this.#callOrder.push("deliverSingle");
    this.deliverSingleInputs.push(input);
    const { userId } = input.data;
    const reason = this.singleSkipReasons.get(userId);
    if (reason != null) {
      return { status: "skipped", reason };
    }
    return {
      status: "sent",
      results: [{ token: `token-${userId}`, status: "accepted", ticketId: `ticket-${userId}` }],
    };
  }

  async prepareBatchDelivery(
    payloads: readonly BatchPushNotificationPayload[],
  ): Promise<PreparedBatchPushDelivery> {
    this.#callOrder.push("prepareBatchDelivery");
    this.preparedPayloads.push([...payloads]);
    const deliverable = payloads.filter(({ userId }) => !this.batchNoTokenUserIds.has(userId));
    const base = {
      attemptedDispatchIds: new Set(deliverable.map(({ dispatchId }) => dispatchId)),
      skippedDispatches: payloads
        .filter(({ userId }) => this.batchNoTokenUserIds.has(userId))
        .map(({ dispatchId }) => ({ dispatchId, reason: "NO_ACTIVE_TOKEN" as const })),
      recipientUserIds: payloads.map(({ userId }) => userId),
    };
    if (deliverable.length === 0) {
      return { status: "empty", ...base };
    }
    return {
      status: "ready",
      ...base,
      providerPayloads: deliverable.map((payload) => ({
        token: `token-${payload.userId}`,
        title: payload.title,
        body: payload.body,
        data: payload.data,
      })),
      dispatchIds: deliverable.map(({ dispatchId }) => dispatchId),
    };
  }

  async sendPreparedBatch(
    prepared: Extract<PreparedBatchPushDelivery, { readonly status: "ready" }>,
  ): Promise<BatchPushNotificationDeliveryResult> {
    this.#callOrder.push("sendPreparedBatch");
    this.sentBatchCount += 1;
    if (this.sendError != null) {
      throw this.sendError;
    }
    return {
      attemptedDispatchIds: prepared.attemptedDispatchIds,
      resultsByDispatch: new Map(
        [...prepared.attemptedDispatchIds].map((dispatchId) => [
          dispatchId,
          [{ token: `token-${dispatchId}`, status: "accepted", ticketId: `ticket-${dispatchId}` }],
        ]),
      ),
    };
  }
}

interface PersistenceObservation {
  readonly operation: PushDeliveryLifecycleOperation;
  readonly transactionDepth: number;
}

function createDeliverPushNotificationsUseCase() {
  const callOrder: string[] = [];
  const observations: PersistenceObservation[] = [];
  const unitOfWork = new DepthTrackingUnitOfWork();
  const lifecycle = new StubPushDeliveryLifecycleRepository((operation) => {
    callOrder.push(operation);
    observations.push({ operation, transactionDepth: unitOfWork.depth });
  });
  const eligibility = new StubDeliveryEligibility(callOrder);
  const payloadFactory = new RecordingPayloadFactory(callOrder);
  const delivery = new StubPushDelivery(callOrder);
  const useCase = new DeliverPushNotificationsUseCase({
    lifecycle,
    unitOfWork,
    eligibility,
    payloadFactory,
    delivery,
    clock: new FixedClock(NOW),
    logger: new SilentLogger(),
  });

  function expectPersistenceInsideUnitOfWork(): void {
    expect(observations.length).toBeGreaterThan(0);
    for (const observation of observations) {
      expect(observation.transactionDepth).toBe(1);
    }
  }

  return {
    useCase,
    callOrder,
    observations,
    unitOfWork,
    lifecycle,
    eligibility,
    payloadFactory,
    delivery,
    expectPersistenceInsideUnitOfWork,
  };
}

describe("DeliverPushNotificationsUseCase — 저장된 Push 발송 처리", () => {
  it("claim 결과가 없으면 delivery나 불필요한 finalize를 수행하지 않는다", async () => {
    // Given
    const {
      useCase,
      lifecycle,
      unitOfWork,
      eligibility,
      delivery,
      expectPersistenceInsideUnitOfWork,
    } = createDeliverPushNotificationsUseCase();
    const input: DeliverPushNotificationsInput = {
      processingJobId: PROCESSING_JOB_ID,
      processingJobAttempt: 1,
      publications: [{ dispatchId: 1, publishAttempt: 1 }],
      isFinalAttempt: false,
    };

    // When
    await useCase.execute(input);

    // Then
    expect(lifecycle.claimInputs).toEqual([
      {
        processingJobId: input.processingJobId,
        processingJobAttempt: input.processingJobAttempt,
        publications: input.publications,
        startedAt: NOW,
      },
    ]);
    expect(lifecycle.operations).toEqual(["claim"]);
    expect(unitOfWork.runCount).toBe(1);
    expect(eligibility.singleRecipientLoads).toEqual([]);
    expect(eligibility.batchRecipientLoads).toEqual([]);
    expect(delivery.deliverSingleInputs).toEqual([]);
    expect(delivery.preparedPayloads).toEqual([]);
    expectPersistenceInsideUnitOfWork();
  });

  it("SINGLE은 claim → recipient → eligibility → payload → delivery → fenced finalize 순서다", async () => {
    // Given
    const fixture = createDeliverPushNotificationsUseCase();
    const claimed = createClaimedDelivery({
      dispatchId: 11,
      deliveryMode: "SINGLE",
      userId: "single-user",
      notificationId: 111,
    });
    fixture.lifecycle.claimed = [claimed];

    // When
    await fixture.useCase.execute(createExecutionInput([claimed]));

    // Then
    expect(fixture.callOrder).toEqual([
      "claim",
      "loadSingleRecipient",
      "evaluateSingle",
      "markRateLimitReserved",
      "createSinglePayload",
      "deliverSingle",
      "finalizeResults",
    ]);
    expect(fixture.payloadFactory.singleInputs).toEqual([
      { data: claimed.item.data, notificationId: 111, dispatchId: 11, locale: "ko" },
    ]);
    expect(fixture.lifecycle.finalizedResults).toEqual([
      [
        {
          fence: claimed.fence,
          context: LOCAL_DATE_CONTEXT,
          results: [
            { token: "token-single-user", status: "accepted", ticketId: "ticket-single-user" },
          ],
        },
      ],
    ]);
    expect(fixture.unitOfWork.runCount).toBe(3);
    fixture.expectPersistenceInsideUnitOfWork();
  });

  it("SINGLE eligibility skip은 payload/provider를 호출하지 않고 같은 fence를 finalize한다", async () => {
    // Given
    const fixture = createDeliverPushNotificationsUseCase();
    const claimed = createClaimedDelivery({
      dispatchId: 12,
      deliveryMode: "SINGLE",
      userId: "push-disabled-user",
    });
    fixture.lifecycle.claimed = [claimed];
    fixture.eligibility.singleSkipReasons.set("push-disabled-user", "PUSH_DISABLED");

    // When
    await fixture.useCase.execute(createExecutionInput([claimed]));

    // Then
    expect(fixture.callOrder).toEqual([
      "claim",
      "loadSingleRecipient",
      "evaluateSingle",
      "finalizeSkipped",
    ]);
    expect(fixture.payloadFactory.singleInputs).toEqual([]);
    expect(fixture.delivery.deliverSingleInputs).toEqual([]);
    expect(fixture.lifecycle.finalizedSkipped).toEqual([
      [{ fence: claimed.fence, context: LOCAL_DATE_CONTEXT, reason: "PUSH_DISABLED" }],
    ]);
    fixture.expectPersistenceInsideUnitOfWork();
  });

  it("SINGLE token skip도 provider 결과 대신 skip reason을 fenced finalize한다", async () => {
    // Given
    const fixture = createDeliverPushNotificationsUseCase();
    const claimed = createClaimedDelivery({
      dispatchId: 13,
      deliveryMode: "SINGLE",
      userId: "no-token-user",
    });
    fixture.lifecycle.claimed = [claimed];
    fixture.delivery.singleSkipReasons.set("no-token-user", "NO_ACTIVE_TOKEN");

    // When
    await fixture.useCase.execute(createExecutionInput([claimed]));

    // Then
    expect(fixture.lifecycle.finalizedSkipped).toEqual([
      [expect.objectContaining({ fence: claimed.fence, reason: "NO_ACTIVE_TOKEN" })],
    ]);
    expect(fixture.lifecycle.finalizedResults).toEqual([]);
    fixture.expectPersistenceInsideUnitOfWork();
  });

  it("mixed SINGLE/BATCH는 저장된 mode를 보존하고 배치 정책 단계별 skip과 결과를 분리한다", async () => {
    // Given
    const fixture = createDeliverPushNotificationsUseCase();
    const settingsSkipped = createClaimedDelivery({
      dispatchId: 201,
      deliveryMode: "BATCH",
      userId: "settings-skipped",
    });
    const single = createClaimedDelivery({
      dispatchId: 101,
      deliveryMode: "SINGLE",
      userId: "single-first",
    });
    const rateLimited = createClaimedDelivery({
      dispatchId: 202,
      deliveryMode: "BATCH",
      userId: "rate-limited",
    });
    const tokenSkipped = createClaimedDelivery({
      dispatchId: 203,
      deliveryMode: "BATCH",
      userId: "token-skipped",
    });
    const sent = createClaimedDelivery({
      dispatchId: 204,
      deliveryMode: "BATCH",
      userId: "batch-sent",
      force: true,
    });
    const claimedDeliveries = [settingsSkipped, single, rateLimited, tokenSkipped, sent];
    fixture.lifecycle.claimed = claimedDeliveries;
    fixture.eligibility.batchSettingsSkipReasons.set("settings-skipped", "PUSH_DISABLED");
    fixture.eligibility.rateLimitedUserIds.add("rate-limited");
    fixture.delivery.batchNoTokenUserIds.add("token-skipped");

    // When
    await fixture.useCase.execute(createExecutionInput(claimedDeliveries));

    // Then
    expect(fixture.eligibility.batchRecipientLoads).toEqual([
      ["settings-skipped", "rate-limited", "token-skipped", "batch-sent"],
    ]);
    expect(fixture.eligibility.batchSettingsCandidates[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dispatchId: 204,
          data: expect.objectContaining({ userId: "batch-sent", force: true }),
        }),
      ]),
    );
    expect(fixture.payloadFactory.batchDispatchIds).toEqual([203, 204]);
    expect(fixture.lifecycle.finalizedSkipped).toEqual([
      [expect.objectContaining({ fence: settingsSkipped.fence, reason: "PUSH_DISABLED" })],
      [expect.objectContaining({ fence: rateLimited.fence, reason: "RATE_LIMITED" })],
      [expect.objectContaining({ fence: tokenSkipped.fence, reason: "NO_ACTIVE_TOKEN" })],
    ]);
    expect(fixture.lifecycle.finalizedResults).toEqual([
      [expect.objectContaining({ fence: single.fence })],
      [
        {
          fence: sent.fence,
          context: LOCAL_DATE_CONTEXT,
          results: [{ token: "token-204", status: "accepted", ticketId: "ticket-204" }],
        },
      ],
    ]);
    expect(fixture.callOrder.indexOf("deliverSingle")).toBeLessThan(
      fixture.callOrder.indexOf("loadBatchRecipients"),
    );
    expect(fixture.delivery.sentBatchCount).toBe(1);
    fixture.expectPersistenceInsideUnitOfWork();
  });

  it("rate-limit 예약은 generation이 바뀌어도 재사용하되 revocable 설정은 다시 평가한다", async () => {
    // Given
    const fixture = createDeliverPushNotificationsUseCase();
    const claimed = createClaimedDelivery({
      dispatchId: 250,
      deliveryMode: "SINGLE",
      userId: "reserved-user",
      publishAttempt: 9,
      rateLimitReservation: { status: "reserved" },
    });
    fixture.lifecycle.claimed = [claimed];

    // When
    await fixture.useCase.execute(createExecutionInput([claimed]));

    // Then
    expect(fixture.eligibility.singleRecipientLoads).toEqual(["reserved-user"]);
    expect(fixture.eligibility.singleEvaluations).toEqual([
      [claimed.item.data, expect.any(Object), 250, true],
    ]);
    expect(fixture.lifecycle.rateLimitReservations).toEqual([]);
    expect(fixture.delivery.deliverSingleInputs).toHaveLength(1);
    expect(fixture.lifecycle.finalizedResults).toEqual([
      [expect.objectContaining({ fence: claimed.fence })],
    ]);
  });

  it("정책 승인 CAS가 일부라도 fence를 잃으면 provider 전에 release하고 retry한다", async () => {
    // Given
    const fixture = createDeliverPushNotificationsUseCase();
    const claimed = createClaimedDelivery({
      dispatchId: 260,
      deliveryMode: "SINGLE",
      userId: "stale-policy-worker",
    });
    fixture.lifecycle.claimed = [claimed];
    fixture.lifecycle.reservableDispatchIds = new Set();

    // When
    const result = fixture.useCase.execute(createExecutionInput([claimed]));

    // Then
    await expect(result).rejects.toBeInstanceOf(PushDeliveryRateLimitReservationConflictError);
    expect(fixture.delivery.deliverSingleInputs).toEqual([]);
    expect(fixture.lifecycle.released).toEqual([
      [
        {
          fence: claimed.fence,
          error: expect.any(String),
          reopenOutbox: false,
          availableAt: NOW,
        },
      ],
    ]);
  });

  it("DB 승인 write 실패 뒤 두 번째 execute도 같은 dispatch rate 예약을 재사용한다", async () => {
    // Given
    const fixture = createDeliverPushNotificationsUseCase();
    const limiter = new InMemoryPushRateLimiterAdapter();
    const claimed = createClaimedDelivery({
      dispatchId: 270,
      deliveryMode: "BATCH",
      userId: "engagement-retry",
      dataOverrides: { type: "LUNCH_NUDGE", purpose: "ENGAGEMENT" },
    });
    fixture.lifecycle.claimed = [claimed];
    fixture.eligibility.rateLimiter = limiter;
    const reservationWriteError = new Error("reservation commit unavailable");
    fixture.lifecycle.failNext("markRateLimitReserved", reservationWriteError);

    // When
    const firstRun = fixture.useCase.execute(createExecutionInput([claimed]));
    await expect(firstRun).rejects.toBe(reservationWriteError);
    const secondRun = fixture.useCase.execute({
      ...createExecutionInput([claimed]),
      processingJobAttempt: 2,
    });

    // Then
    await expect(secondRun).resolves.toBeUndefined();
    expect(fixture.eligibility.reserveBatchCount).toBe(2);
    expect(fixture.lifecycle.finalizedSkipped.flat()).not.toContainEqual(
      expect.objectContaining({ reason: "RATE_LIMITED" }),
    );
    expect(fixture.delivery.sentBatchCount).toBe(1);
  });

  it("마지막 runtime attempt의 provider 오류는 lease와 outbox를 reopen하고 다시 던진다", async () => {
    // Given
    const fixture = createDeliverPushNotificationsUseCase();
    const first = createClaimedDelivery({
      dispatchId: 301,
      deliveryMode: "BATCH",
      userId: "first-batch-user",
    });
    const second = createClaimedDelivery({
      dispatchId: 302,
      deliveryMode: "BATCH",
      userId: "second-batch-user",
    });
    const claimedDeliveries = [first, second];
    fixture.lifecycle.claimed = claimedDeliveries;
    const providerError = new RetryablePushProviderTransportError(
      {
        providerName: "expo",
        resolvedPayloadCountBeforeFailure: 1,
        acceptedTicketCountBeforeFailure: 1,
        unconfirmedPayloadCount: 1,
        unattemptedPayloadCount: 0,
      },
      { cause: new Error("expo provider unavailable") },
    );
    fixture.delivery.sendError = providerError;

    // When
    const result = fixture.useCase.execute({
      ...createExecutionInput(claimedDeliveries),
      isFinalAttempt: true,
    });

    // Then
    await expect(result).rejects.toBe(providerError);
    expect(fixture.lifecycle.released).toEqual([
      claimedDeliveries.map(({ fence }) => ({
        fence,
        error: providerError.message,
        reopenOutbox: true,
        availableAt: expect.any(Temporal.Instant),
      })),
    ]);
    expect(fixture.observations.at(-1)).toEqual({ operation: "release", transactionDepth: 1 });
    fixture.expectPersistenceInsideUnitOfWork();
  });

  it("provider 성공 후 finalize 실패는 lease를 release해 at-least-once 재시도를 허용한다", async () => {
    // Given
    const fixture = createDeliverPushNotificationsUseCase();
    const claimed = createClaimedDelivery({
      dispatchId: 401,
      deliveryMode: "SINGLE",
      userId: "accepted-before-finalize",
      dataOverrides: {
        title: "이전 버전에서 저장한 제목",
        body: "친구가 직접 남긴 {count} 문장",
        campaignKey: "follow_request_v1",
        variantId: "follow_request_v1.v2",
        metadata: { copyRevision: "1.11.0" },
      },
    });
    fixture.lifecycle.claimed = [claimed];
    const finalizeResultsError = new Error("database commit unavailable");
    fixture.lifecycle.failNext("finalizeResults", finalizeResultsError);

    // When
    const firstRun = fixture.useCase.execute(createExecutionInput([claimed]));

    // Then
    await expect(firstRun).rejects.toThrow(finalizeResultsError);
    expect(fixture.delivery.deliverSingleInputs).toHaveLength(1);
    expect(fixture.lifecycle.finalizedResults).toEqual([
      [expect.objectContaining({ fence: claimed.fence })],
    ]);
    expect(fixture.lifecycle.released).toEqual([
      [
        {
          fence: claimed.fence,
          error: finalizeResultsError.message,
          reopenOutbox: false,
          availableAt: NOW,
        },
      ],
    ]);
    expect(fixture.callOrder).toEqual([
      "claim",
      "loadSingleRecipient",
      "evaluateSingle",
      "markRateLimitReserved",
      "createSinglePayload",
      "deliverSingle",
      "finalizeResults",
      "release",
    ]);
    expect(fixture.unitOfWork.runCount).toBe(4);
    fixture.expectPersistenceInsideUnitOfWork();

    // When - 다음 실행에 다시 claim된 저장 문구를 payload mapper로 변환한다(DB claim·rollback이 아니라 문자열 전달 계약만 본다)
    await fixture.useCase.execute(createExecutionInput([claimed]));

    // Then - 현재 catalog revision·수신자 설정으로 다시 만들지 않는다
    const retried = fixture.delivery.deliverSingleInputs[1];
    expect(retried?.payload).toMatchObject({
      title: "이전 버전에서 저장한 제목",
      body: "친구가 직접 남긴 {count} 문장",
      data: { campaignKey: "follow_request_v1", variantId: "follow_request_v1.v2" },
    });
    expect(retried?.data.metadata).toEqual({ copyRevision: "1.11.0" });
    fixture.expectPersistenceInsideUnitOfWork();
  });

  it("중간 attempt의 initial claim DB 오류는 publication을 reopen하지 않고 원본 오류를 보존한다", async () => {
    // Given
    const fixture = createDeliverPushNotificationsUseCase();
    const claimError = new Error("claim database unavailable");
    fixture.lifecycle.failNext("claim", claimError);
    const input = {
      ...createExecutionInput([
        createClaimedDelivery({ dispatchId: 401, deliveryMode: "SINGLE", userId: "claim-user" }),
      ]),
      isFinalAttempt: false,
    };

    // When
    const result = fixture.useCase.execute(input);

    // Then
    await expect(result).rejects.toBe(claimError);
    expect(fixture.lifecycle.reopenAfterFinalClaimFailureInputs).toEqual([]);
  });

  it("마지막 attempt의 initial claim 오류는 matching generation을 UOW에서 reopen한다", async () => {
    // Given
    const fixture = createDeliverPushNotificationsUseCase();
    const claimError = new Error("claim database recovered");
    fixture.lifecycle.failNext("claim", claimError);
    const input = {
      ...createExecutionInput([
        createClaimedDelivery({ dispatchId: 402, deliveryMode: "SINGLE", userId: "claim-user" }),
      ]),
      isFinalAttempt: true,
    };

    // When
    const result = fixture.useCase.execute(input);

    // Then
    await expect(result).rejects.toBe(claimError);
    expect(fixture.lifecycle.reopenAfterFinalClaimFailureInputs).toEqual([
      { publications: input.publications, availableAt: NOW, error: claimError.message },
    ]);
    fixture.expectPersistenceInsideUnitOfWork();
  });

  it("마지막 claim recovery가 partial이거나 DB 실패해도 원본 claim 오류를 바꾸지 않는다", async () => {
    // Given
    const fixture = createDeliverPushNotificationsUseCase();
    const input = {
      ...createExecutionInput([
        createClaimedDelivery({ dispatchId: 403, deliveryMode: "SINGLE", userId: "claim-user" }),
      ]),
      isFinalAttempt: true,
    };
    const firstClaimError = new Error("first claim failure");
    fixture.lifecycle.failNext("claim", firstClaimError);
    fixture.lifecycle.reopenableCount = 0;

    // When
    const partialRecovery = fixture.useCase.execute(input);

    // Then
    await expect(partialRecovery).rejects.toBe(firstClaimError);

    // Given
    const secondClaimError = new Error("second claim failure");
    fixture.lifecycle.failNext("claim", secondClaimError);
    fixture.lifecycle.failNext(
      "reopenAfterFinalClaimFailure",
      new Error("recovery database unavailable"),
    );

    // When
    const failedRecovery = fixture.useCase.execute(input);

    // Then
    await expect(failedRecovery).rejects.toBe(secondClaimError);
  });
});
