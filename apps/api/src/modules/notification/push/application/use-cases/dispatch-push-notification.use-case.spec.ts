import type { PushPermissionStatus } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FakePushProvider } from "#test/doubles/notification/fake-push-provider";
import { InMemoryPushDeviceRepository } from "#test/doubles/notification/in-memory-push-device.repository";
import { InMemoryPushTokenRepository } from "#test/doubles/notification/in-memory-push-token.repository";
import { PassThroughNotificationCache } from "#test/doubles/notification/pass-through-notification-cache";
import { StubActivePushTokenReader } from "#test/doubles/notification/stub-active-push-token.reader";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createNotificationDraftFixture } from "#test/fixtures/notification/notification.fixture";
import { createPushDeviceFixture } from "#test/fixtures/notification/push-device.fixture";
import { createPushTokenFixture } from "#test/fixtures/notification/push-token.fixture";

import type { PushDevice } from "../../domain/push-device.aggregate.js";
import type { BatchPushNotificationPayload } from "../ports/push-notification-payload.port.js";
import { RetryablePushProviderTransportError } from "../ports/push-provider.port.js";
import type { PushTokenRecord } from "../read-models/push-token.read-model.js";
import { DispatchPushNotificationUseCase } from "./dispatch-push-notification.use-case.js";

const NOW = Temporal.Instant.from("2026-11-10T00:00:00.000Z");
let tokenSequence = 0;

function pushToken(input: {
  userId: string;
  token: string;
  payloadVersion: number;
  appVersion: string | null;
}): PushTokenRecord {
  tokenSequence += 1;
  return createPushTokenFixture({
    id: tokenSequence,
    deviceId: `device-${input.token}`,
    ...input,
  });
}

const DELIVERY_OPTIONS = { priority: "high", ttlSeconds: 3600 } as const;

function batchPayload(input: {
  userId: string;
  dispatchId: number;
  requiresFeatureCapability?: boolean;
  minAppVersion?: string;
}): BatchPushNotificationPayload {
  return {
    userId: input.userId,
    dispatchId: input.dispatchId,
    requiresFeatureCapability: input.requiresFeatureCapability ?? false,
    ...(input.minAppVersion != null && { minAppVersion: input.minAppVersion }),
    title: `title-${input.dispatchId}`,
    body: `body-${input.dispatchId}`,
    data: { dispatchId: input.dispatchId },
    ...DELIVERY_OPTIONS,
  };
}

function reportedDevice(input: {
  userId: string;
  status: PushPermissionStatus;
  reportedAt?: Temporal.Instant;
}): PushDevice {
  return createPushDeviceFixture({
    deviceId: `ios_${input.userId}`,
    userId: input.userId,
    permissionStatus: input.status,
    token: null,
    reportedAt: input.reportedAt ?? NOW,
  });
}

function createDispatchUseCase(
  options: {
    readonly devices?: readonly PushDevice[];
    readonly tokens?: readonly PushTokenRecord[];
    readonly activeTokens?: Iterable<readonly [string, readonly string[]]>;
  } = {},
) {
  const pushTokenRepository = new InMemoryPushTokenRepository(options.tokens);
  const activePushTokenReader = new StubActivePushTokenReader(options.activeTokens);
  const pushProvider = new FakePushProvider();
  const notificationCache = new PassThroughNotificationCache();
  const service = new DispatchPushNotificationUseCase({
    pushTokenRepository,
    pushDeviceRepository: new InMemoryPushDeviceRepository(options.devices),
    pushProvider,
    activePushTokenReader,
    notificationCache,
    clock: new FixedClock(NOW),
    logger: new SilentLogger(),
  });
  return { service, pushTokenRepository, activePushTokenReader, pushProvider, notificationCache };
}

async function activeTokensOf(
  repository: InMemoryPushTokenRepository,
  userIds: string[],
): Promise<string[]> {
  const records = await repository.findActivePushTokensByUsers(
    userIds.map((userId) => UserId.reconstitute(userId)),
  );
  return records.map(({ token }) => token).toSorted();
}

describe("DispatchPushNotificationUseCase — 토큰 선택과 공급자 전달", () => {
  it("일반 단건은 cache-aside reader의 활성 토큰이 없으면 provider를 호출하지 않는다", async () => {
    // Given
    const { service, activePushTokenReader, pushProvider } = createDispatchUseCase();

    // When
    const result = await service.deliverSingle({
      data: createNotificationDraftFixture({ userId: "user-1", title: "title", body: "body" }),
      payload: { title: "title", body: "body", ...DELIVERY_OPTIONS },
    });

    // Then
    expect(result).toEqual({ status: "skipped", reason: "NO_ACTIVE_TOKEN" });
    expect(activePushTokenReader.lookedUpUserIds).toEqual(["user-1"]);
    expect(pushProvider.sentBatches).toEqual([]);
  });

  it("활성 토큰이 없으면 최근 보고한 기기 권한으로 건너뜀 사유를 나눈다", async () => {
    // Given - user-1은 거절, user-2는 아직 묻지 않음, user-3은 90일 넘게 보고가 없다
    const { service } = createDispatchUseCase({
      devices: [
        reportedDevice({ userId: "user-1", status: "DENIED" }),
        reportedDevice({ userId: "user-2", status: "NOT_DETERMINED" }),
        reportedDevice({
          userId: "user-3",
          status: "DENIED",
          reportedAt: NOW.subtract({ hours: 91 * 24 }),
        }),
      ],
    });

    // When
    const prepared = await service.prepareBatchDelivery([
      batchPayload({ userId: "user-1", dispatchId: 1 }),
      batchPayload({ userId: "user-2", dispatchId: 2 }),
      batchPayload({ userId: "user-3", dispatchId: 3 }),
    ]);

    // Then
    expect(prepared.skippedDispatches).toEqual([
      { dispatchId: 1, reason: "PUSH_PERMISSION_DENIED" },
      { dispatchId: 2, reason: "PUSH_PERMISSION_NOT_REQUESTED" },
      { dispatchId: 3, reason: "NO_ACTIVE_TOKEN" },
    ]);
  });

  it("단건도 거절한 기기만 있으면 PUSH_PERMISSION_DENIED로 건너뛴다", async () => {
    // Given
    const { service } = createDispatchUseCase({
      devices: [reportedDevice({ userId: "user-1", status: "DENIED" })],
    });

    // When
    const result = await service.deliverSingle({
      data: createNotificationDraftFixture({ userId: "user-1", title: "title", body: "body" }),
      payload: { title: "title", body: "body", ...DELIVERY_OPTIONS },
    });

    // Then
    expect(result).toEqual({ status: "skipped", reason: "PUSH_PERMISSION_DENIED" });
  });

  it("feature-discovery 단건은 활성 토큰과 지원 capability 부재를 구분한다", async () => {
    // Given
    const { service, activePushTokenReader } = createDispatchUseCase({
      tokens: [
        pushToken({
          userId: "user-1",
          token: "legacy-token",
          payloadVersion: 1,
          appVersion: "1.9.0",
        }),
      ],
    });

    // When
    const result = await service.deliverSingle({
      data: createNotificationDraftFixture({
        userId: "user-1",
        type: "SYSTEM_NOTICE",
        title: "title",
        body: "body",
        campaignKey: "feature-discovery-2026-08",
      }),
      payload: { title: "title", body: "body", ...DELIVERY_OPTIONS },
    });

    // Then
    expect(result).toEqual({ status: "skipped", reason: "UNSUPPORTED_APP_CAPABILITY" });
    expect(activePushTokenReader.lookedUpUserIds).toEqual([]);
  });

  it.each(["NUDGE_REPLIED", "NUDGE_THANKED"] as const)(
    "%s 알림은 같은 사용자의 여러 기기 중 1.11.0 이상 기기에만 보낸다",
    async (type) => {
      // Given
      const { service, activePushTokenReader, pushProvider } = createDispatchUseCase({
        tokens: [
          pushToken({
            userId: "user-1",
            token: "old-token",
            payloadVersion: 2,
            appVersion: "1.10.1",
          }),
          pushToken({
            userId: "user-1",
            token: "unknown-token",
            payloadVersion: 2,
            appVersion: null,
          }),
          pushToken({
            userId: "user-1",
            token: "new-token",
            payloadVersion: 2,
            appVersion: "1.11.0",
          }),
        ],
      });

      // When
      const result = await service.deliverSingle({
        data: createNotificationDraftFixture({
          userId: "user-1",
          type,
          title: "친구의 답장",
          body: "곧 시작해요",
        }),
        payload: { title: "친구의 답장", body: "곧 시작해요", ...DELIVERY_OPTIONS },
      });

      // Then
      expect(result.status).toBe("sent");
      expect(pushProvider.sentBatches).toEqual([
        [{ token: "new-token", title: "친구의 답장", body: "곧 시작해요", ...DELIVERY_OPTIONS }],
      ]);
      expect(activePushTokenReader.lookedUpUserIds).toEqual([]);
    },
  );

  it.each([
    "INVITE_JOINED",
    "INVITE_REWARDED",
    "INVITE_PROGRESS",
    "INVITE_QUALIFY_REMINDER",
    "PREMIUM_GRANT_ENDING",
  ] as const)("%s 알림은 1.12.1 기기에는 보내지 않고 1.13.0 이상 기기에만 보낸다", async (type) => {
    // Given
    const { service, pushProvider } = createDispatchUseCase({
      tokens: [
        pushToken({
          userId: "user-1",
          token: "released-token",
          payloadVersion: 2,
          appVersion: "1.12.1",
        }),
        pushToken({
          userId: "user-1",
          token: "updated-token",
          payloadVersion: 2,
          appVersion: "1.13.0",
        }),
      ],
    });

    // When
    const result = await service.deliverSingle({
      data: createNotificationDraftFixture({ userId: "user-1", type, title: "초대", body: "본문" }),
      payload: { title: "초대", body: "본문", ...DELIVERY_OPTIONS },
    });

    // Then
    expect(result.status).toBe("sent");
    expect(pushProvider.sentBatches).toEqual([
      [{ token: "updated-token", title: "초대", body: "본문", ...DELIVERY_OPTIONS }],
    ]);
  });

  it("답장·감사 배치는 기존 알림을 구버전에도 보내고 새 유형만 지원 기기에 제한한다", async () => {
    // Given
    const { service } = createDispatchUseCase({
      activeTokens: [
        ["mixed", ["old-token", "new-token"]],
        ["old-only", ["unsupported-token"]],
      ],
      tokens: [
        pushToken({ userId: "mixed", token: "old-token", payloadVersion: 2, appVersion: "1.10.0" }),
        pushToken({ userId: "mixed", token: "new-token", payloadVersion: 2, appVersion: "1.11.0" }),
        pushToken({
          userId: "old-only",
          token: "unsupported-token",
          payloadVersion: 2,
          appVersion: "1.10.1",
        }),
      ],
    });

    // When
    const prepared = await service.prepareBatchDelivery([
      batchPayload({ userId: "mixed", dispatchId: 1 }),
      batchPayload({ userId: "mixed", dispatchId: 2, minAppVersion: "1.11.0" }),
      batchPayload({ userId: "old-only", dispatchId: 3, minAppVersion: "1.11.0" }),
      batchPayload({ userId: "missing", dispatchId: 4, minAppVersion: "1.11.0" }),
    ]);

    // Then
    if (prepared.status !== "ready") {
      throw new Error("전송할 알림 배치가 필요합니다");
    }
    expect(prepared.providerPayloads).toEqual([
      {
        token: "old-token",
        title: "title-1",
        body: "body-1",
        data: { dispatchId: 1 },
        ...DELIVERY_OPTIONS,
      },
      {
        token: "new-token",
        title: "title-1",
        body: "body-1",
        data: { dispatchId: 1 },
        ...DELIVERY_OPTIONS,
      },
      {
        token: "new-token",
        title: "title-2",
        body: "body-2",
        data: { dispatchId: 2 },
        ...DELIVERY_OPTIONS,
      },
    ]);
    expect(prepared.skippedDispatches).toEqual([
      { dispatchId: 3, reason: "UNSUPPORTED_APP_CAPABILITY" },
      { dispatchId: 4, reason: "NO_ACTIVE_TOKEN" },
    ]);
  });

  it("한 사용자의 기기 셋 중 하나가 미등록으로 실패해도 나머지 둘에 한 번씩 보내고 실패한 기기 토큰만 끈다", async () => {
    // Given 휴대폰·태블릿·노트북 앱을 함께 쓰는 사용자
    const deviceTokens = ["phone-token", "tablet-token", "laptop-token"];
    const { service, pushTokenRepository, pushProvider } = createDispatchUseCase({
      activeTokens: [["user-1", deviceTokens]],
      tokens: deviceTokens.map((token) =>
        pushToken({ userId: "user-1", token, payloadVersion: 2, appVersion: "1.15.0" }),
      ),
    });
    pushProvider.nextResults = async (payloads) =>
      payloads.map((payload) =>
        payload.token === "tablet-token"
          ? { token: payload.token, status: "rejected", failure: { kind: "DEVICE_UNREGISTERED" } }
          : { token: payload.token, status: "accepted", ticketId: `ticket-${payload.token}` },
      );

    // When
    const result = await service.deliverSingle({
      data: createNotificationDraftFixture({ userId: "user-1", title: "title", body: "body" }),
      payload: { title: "title", body: "body", ...DELIVERY_OPTIONS },
    });

    // Then
    expect(pushProvider.getSentPayloads().map(({ token }) => token)).toEqual(deviceTokens);
    expect(result).toEqual({
      status: "sent",
      results: [
        { token: "phone-token", status: "accepted", ticketId: "ticket-phone-token" },
        { token: "tablet-token", status: "rejected", failure: { kind: "DEVICE_UNREGISTERED" } },
        { token: "laptop-token", status: "accepted", ticketId: "ticket-laptop-token" },
      ],
    });
    expect(await activeTokensOf(pushTokenRepository, ["user-1"])).toEqual([
      "laptop-token",
      "phone-token",
    ]);
  });

  it("단건 provider가 invalid token을 반환하면 저장소 비활성화와 해당 사용자 캐시 무효화를 완료한다", async () => {
    // Given
    const { service, pushTokenRepository, pushProvider, notificationCache } = createDispatchUseCase(
      {
        activeTokens: [["user-1", ["invalid-token"]]],
        tokens: [
          pushToken({
            userId: "user-1",
            token: "invalid-token",
            payloadVersion: 2,
            appVersion: null,
          }),
        ],
      },
    );
    pushProvider.nextResults = async (payloads) =>
      payloads.map((payload) => ({
        token: payload.token,
        status: "rejected",
        failure: { kind: "DEVICE_UNREGISTERED" },
      }));

    // When
    const result = await service.deliverSingle({
      data: createNotificationDraftFixture({ userId: "user-1", title: "title", body: "body" }),
      payload: { title: "title", body: "body", categoryId: "TEST", ...DELIVERY_OPTIONS },
    });

    // Then
    expect(result).toMatchObject({
      status: "sent",
      results: [{ token: "invalid-token", status: "rejected" }],
    });
    expect(pushProvider.sentBatches).toEqual([
      [
        {
          token: "invalid-token",
          title: "title",
          body: "body",
          categoryId: "TEST",
          ...DELIVERY_OPTIONS,
        },
      ],
    ]);
    expect(await activeTokensOf(pushTokenRepository, ["user-1"])).toEqual([]);
    expect(pushTokenRepository.tokenOf("user-1", "device-invalid-token")?.updatedAt).toEqual(NOW);
    expect(notificationCache.invalidatedPushTokenUserIds).toEqual(["user-1"]);
  });

  it("배치는 generic·feature 토큰을 각 계약으로 선택하고 dispatch별 결과와 skip 이유를 보존한다", async () => {
    // Given
    const { service, pushProvider } = createDispatchUseCase({
      activeTokens: [
        ["generic", ["generic-token"]],
        ["feature", ["ignored-generic-token"]],
      ],
      tokens: [
        pushToken({
          userId: "feature",
          token: "feature-token",
          payloadVersion: 2,
          appVersion: "1.8.0",
        }),
        pushToken({
          userId: "unsupported",
          token: "unsupported-token",
          payloadVersion: 1,
          appVersion: "1.9.0",
        }),
      ],
    });
    pushProvider.nextResults = async () => [
      { token: "generic-token", status: "accepted", ticketId: "ticket-1" },
      { token: "feature-token", status: "accepted", ticketId: "ticket-2" },
    ];

    // When
    const prepared = await service.prepareBatchDelivery([
      batchPayload({ userId: "generic", dispatchId: 1 }),
      batchPayload({ userId: "feature", dispatchId: 2, requiresFeatureCapability: true }),
      batchPayload({ userId: "missing", dispatchId: 3 }),
      batchPayload({ userId: "unsupported", dispatchId: 4, requiresFeatureCapability: true }),
    ]);
    if (prepared.status !== "ready") {
      throw new Error("Expected a prepared batch delivery");
    }
    const result = await service.sendPreparedBatch(prepared);

    // Then
    expect(pushProvider.sentBatches).toEqual([
      [
        {
          token: "generic-token",
          title: "title-1",
          body: "body-1",
          data: { dispatchId: 1 },
          ...DELIVERY_OPTIONS,
        },
        {
          token: "feature-token",
          title: "title-2",
          body: "body-2",
          data: { dispatchId: 2 },
          ...DELIVERY_OPTIONS,
        },
      ],
    ]);
    expect([...prepared.attemptedDispatchIds]).toEqual([1, 2]);
    expect(result.resultsByDispatch.get(1)).toEqual([
      { token: "generic-token", status: "accepted", ticketId: "ticket-1" },
    ]);
    expect(result.resultsByDispatch.get(2)).toEqual([
      { token: "feature-token", status: "accepted", ticketId: "ticket-2" },
    ]);
    expect(prepared.skippedDispatches).toEqual([
      { dispatchId: 3, reason: "NO_ACTIVE_TOKEN" },
      { dispatchId: 4, reason: "UNSUPPORTED_APP_CAPABILITY" },
    ]);
  });

  it("배치 invalid token은 기존 계약대로 배치 수신자 전체 token cache를 무효화한다", async () => {
    // Given
    const { service, pushTokenRepository, pushProvider, notificationCache } = createDispatchUseCase(
      {
        activeTokens: [
          ["user-1", ["invalid-token"]],
          ["user-2", ["valid-token"]],
        ],
        tokens: [
          pushToken({
            userId: "user-1",
            token: "invalid-token",
            payloadVersion: 2,
            appVersion: null,
          }),
          pushToken({
            userId: "user-2",
            token: "valid-token",
            payloadVersion: 2,
            appVersion: null,
          }),
        ],
      },
    );
    pushProvider.nextResults = async () => [
      { token: "invalid-token", status: "rejected", failure: { kind: "DEVICE_UNREGISTERED" } },
      { token: "valid-token", status: "accepted", ticketId: "ticket-valid" },
    ];
    const prepared = await service.prepareBatchDelivery([
      batchPayload({ userId: "user-1", dispatchId: 1 }),
      batchPayload({ userId: "user-2", dispatchId: 2 }),
    ]);
    if (prepared.status !== "ready") {
      throw new Error("Expected a prepared batch delivery");
    }

    // When
    await service.sendPreparedBatch(prepared);

    // Then
    expect(await activeTokensOf(pushTokenRepository, ["user-1", "user-2"])).toEqual([
      "valid-token",
    ]);
    expect(notificationCache.invalidatedPushTokenUserIds).toEqual(["user-1", "user-2"]);
  });

  it("배치 provider transport 오류는 token 상태를 변경하지 않고 같은 오류를 재전파한다", async () => {
    // Given
    const { service, pushTokenRepository, pushProvider, notificationCache } = createDispatchUseCase(
      {
        activeTokens: [["user-1", ["ExponentPushToken[user-1]"]]],
        tokens: [
          pushToken({
            userId: "user-1",
            token: "ExponentPushToken[user-1]",
            payloadVersion: 2,
            appVersion: null,
          }),
        ],
      },
    );
    const prepared = await service.prepareBatchDelivery([
      batchPayload({ userId: "user-1", dispatchId: 1 }),
    ]);
    if (prepared.status !== "ready") {
      throw new Error("Expected a prepared batch delivery");
    }
    const transportError = new RetryablePushProviderTransportError(
      {
        providerName: "expo",
        resolvedPayloadCountBeforeFailure: 0,
        acceptedTicketCountBeforeFailure: 0,
        unconfirmedPayloadCount: 1,
        unattemptedPayloadCount: 0,
      },
      { cause: new Error("network unavailable") },
    );
    pushProvider.nextResults = async () => {
      throw transportError;
    };

    // When
    const result = service.sendPreparedBatch(prepared);

    // Then
    await expect(result).rejects.toBe(transportError);
    expect(await activeTokensOf(pushTokenRepository, ["user-1"])).toEqual([
      "ExponentPushToken[user-1]",
    ]);
    expect(notificationCache.invalidatedPushTokenUserIds).toEqual([]);
  });
});
