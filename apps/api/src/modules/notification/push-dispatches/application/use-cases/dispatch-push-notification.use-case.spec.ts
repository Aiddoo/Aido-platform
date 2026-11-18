import type { PushPermissionStatus } from "@aido/api/vocabulary";

import { PushDispatchId } from "#api/modules/notification/push-dispatches/domain/push-dispatch-id.vo";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  FakePushChannel,
  pushChannelRegistryOf,
} from "#test/doubles/notification/fake-push-channel";
import { InMemoryPushDeviceRepository } from "#test/doubles/notification/in-memory-push-device.repository";
import { InMemoryPushTokenRepository } from "#test/doubles/notification/in-memory-push-token.repository";
import { RecordingPushTokenCache } from "#test/doubles/notification/recording-push-token-cache";
import { StubActivePushTokenReader } from "#test/doubles/notification/stub-active-push-token.reader";
import { StubUnreadNotificationCountReader } from "#test/doubles/notification/stub-unread-notification-count.reader";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createNotificationDraftFixture } from "#test/fixtures/notification/notification.fixture";
import { createPushDeviceFixture } from "#test/fixtures/notification/push-device.fixture";
import { createPushTokenFixture } from "#test/fixtures/notification/push-token.fixture";

import type { PushTokenReadModel } from "../../../push-devices/application/read-models/push-token.read-model.js";
import type { PushDevice } from "../../../push-devices/domain/push-device.aggregate.js";
import { PushCategoryId } from "../../domain/push-category-id.vo.js";
import { PushTicketId } from "../../domain/push-ticket-id.vo.js";
import { NoActiveTokenReasonReader } from "../no-active-token-reason.reader.js";
import type { BatchPushNotificationPayload } from "../ports/push-notification-payload.port.js";
import { RetryablePushProviderTransportError } from "../push-dispatches.errors.js";
import { DispatchPushNotificationUseCase } from "./dispatch-push-notification.use-case.js";
import { PreparePushBatchUseCase } from "./prepare-push-batch.use-case.js";
import { SendPushBatchUseCase } from "./send-push-batch.use-case.js";
import { SendPushMessagesUseCase } from "./send-push-messages.use-case.js";

const NOW = Temporal.Instant.from("2026-11-10T00:00:00.000Z");
let tokenSequence = 0;

function pushToken(input: {
  userId: string;
  token: string;
  payloadVersion: number;
  appVersion: string | null;
}): PushTokenReadModel {
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
    userId: UserId.reconstitute(input.userId),
    dispatchId: PushDispatchId.reconstitute(input.dispatchId),
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
    readonly tokens?: readonly PushTokenReadModel[];
    readonly activeTokens?: ConstructorParameters<typeof StubActivePushTokenReader>[0];
    readonly unreadCounts?: Iterable<readonly [string, number]>;
  } = {},
) {
  const pushTokenRepository = new InMemoryPushTokenRepository(options.tokens);
  const activePushTokenReader = new StubActivePushTokenReader(options.activeTokens);
  const pushProvider = new FakePushChannel();
  const sendMessages = new SendPushMessagesUseCase({
    channels: pushChannelRegistryOf(pushProvider),
  });
  const pushTokenCache = new RecordingPushTokenCache();
  const unreadCounts = new StubUnreadNotificationCountReader(options.unreadCounts);
  const clock = new FixedClock(NOW);
  const noActiveTokenReasons = new NoActiveTokenReasonReader({
    pushDeviceRepository: new InMemoryPushDeviceRepository(options.devices),
    clock,
  });
  const service = {
    dispatchPush: new DispatchPushNotificationUseCase({
      pushTokenRepository,
      sendMessages,
      unreadCounts,
      activePushTokenReader,
      pushTokenCache,
      noActiveTokenReasons,
      clock,
      logger: new SilentLogger(),
    }),
    preparePushBatch: new PreparePushBatchUseCase({
      pushTokenRepository,
      activePushTokenReader,
      noActiveTokenReasons,
      unreadCounts,
    }),
    sendPushBatch: new SendPushBatchUseCase({
      pushTokenRepository,
      sendMessages,
      pushTokenCache,
      clock,
      logger: new SilentLogger(),
    }),
  };
  return {
    service,
    pushTokenRepository,
    activePushTokenReader,
    pushProvider,
    pushTokenCache,
    unreadCounts,
  };
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

describe("푸시 단건 발송·배치 준비·배치 전송 — 토큰 선택과 공급자 전달", () => {
  it("일반 단건은 cache-aside reader의 활성 토큰이 없으면 provider를 호출하지 않는다", async () => {
    // Given
    const { service, activePushTokenReader, pushProvider } = createDispatchUseCase();

    // When
    const result = await service.dispatchPush.execute({
      data: createNotificationDraftFixture({ userId: "user-1", title: "title", body: "body" }),
      payload: { title: "title", body: "body", ...DELIVERY_OPTIONS },
    });

    // Then
    expect(result).toEqual({ status: "skipped", reason: "NO_ACTIVE_TOKEN" });
    expect(activePushTokenReader.lookedUpUserIds).toEqual(["user-1"]);
    expect(pushProvider.sentBatches).toEqual([]);
  });

  it("활성 토큰이 없으면 최근 보고한 기기 권한으로 건너뜀 사유를 나눈다", async () => {
    // Given
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
    const prepared = await service.preparePushBatch.execute([
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
    const result = await service.dispatchPush.execute({
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
    const result = await service.dispatchPush.execute({
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
      const result = await service.dispatchPush.execute({
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
        [
          {
            channel: "EXPO",
            token: "new-token",
            title: "친구의 답장",
            body: "곧 시작해요",
            ...DELIVERY_OPTIONS,
          },
        ],
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
    const result = await service.dispatchPush.execute({
      data: createNotificationDraftFixture({ userId: "user-1", type, title: "초대", body: "본문" }),
      payload: { title: "초대", body: "본문", ...DELIVERY_OPTIONS },
    });

    // Then
    expect(result.status).toBe("sent");
    expect(pushProvider.sentBatches).toEqual([
      [
        {
          channel: "EXPO",
          token: "updated-token",
          title: "초대",
          body: "본문",
          ...DELIVERY_OPTIONS,
        },
      ],
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
    const prepared = await service.preparePushBatch.execute([
      batchPayload({ userId: "mixed", dispatchId: 1 }),
      batchPayload({ userId: "mixed", dispatchId: 2, minAppVersion: "1.11.0" }),
      batchPayload({ userId: "old-only", dispatchId: 3, minAppVersion: "1.11.0" }),
      batchPayload({ userId: "missing", dispatchId: 4, minAppVersion: "1.11.0" }),
    ]);

    // Then
    if (prepared.status !== "ready") {
      throw new Error("전송할 알림 배치가 필요합니다");
    }
    expect(prepared.messages).toEqual([
      {
        channel: "EXPO",
        token: "old-token",
        title: "title-1",
        body: "body-1",
        data: { dispatchId: 1 },
        ...DELIVERY_OPTIONS,
      },
      {
        channel: "EXPO",
        token: "new-token",
        title: "title-1",
        body: "body-1",
        data: { dispatchId: 1 },
        ...DELIVERY_OPTIONS,
      },
      {
        channel: "EXPO",
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
    // Given
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
          : {
              token: payload.token,
              status: "accepted",
              ticketId: PushTicketId.reconstitute(`ticket-${payload.token}`),
            },
      );

    // When
    const result = await service.dispatchPush.execute({
      data: createNotificationDraftFixture({ userId: "user-1", title: "title", body: "body" }),
      payload: { title: "title", body: "body", ...DELIVERY_OPTIONS },
    });

    // Then
    expect(pushProvider.getSentPayloads().map(({ token }) => token)).toEqual(deviceTokens);
    expect(result).toEqual({
      status: "sent",
      results: [
        {
          token: "phone-token",
          status: "accepted",
          ticketId: PushTicketId.reconstitute("ticket-phone-token"),
        },
        { token: "tablet-token", status: "rejected", failure: { kind: "DEVICE_UNREGISTERED" } },
        {
          token: "laptop-token",
          status: "accepted",
          ticketId: PushTicketId.reconstitute("ticket-laptop-token"),
        },
      ],
    });
    expect(await activeTokensOf(pushTokenRepository, ["user-1"])).toEqual([
      "laptop-token",
      "phone-token",
    ]);
  });

  it("단건 provider가 invalid token을 반환하면 저장소 비활성화와 해당 사용자 캐시 무효화를 완료한다", async () => {
    // Given
    const { service, pushTokenRepository, pushProvider, pushTokenCache } = createDispatchUseCase({
      activeTokens: [["user-1", ["invalid-token"]]],
      tokens: [
        pushToken({
          userId: "user-1",
          token: "invalid-token",
          payloadVersion: 2,
          appVersion: null,
        }),
      ],
    });
    pushProvider.nextResults = async (payloads) =>
      payloads.map((payload) => ({
        token: payload.token,
        status: "rejected",
        failure: { kind: "DEVICE_UNREGISTERED" },
      }));

    // When
    const result = await service.dispatchPush.execute({
      data: createNotificationDraftFixture({ userId: "user-1", title: "title", body: "body" }),
      payload: {
        title: "title",
        body: "body",
        categoryId: PushCategoryId.reconstitute("TEST"),
        ...DELIVERY_OPTIONS,
      },
    });

    // Then
    expect(result).toMatchObject({
      status: "sent",
      results: [{ token: "invalid-token", status: "rejected" }],
    });
    expect(pushProvider.sentBatches).toEqual([
      [
        {
          channel: "EXPO",
          token: "invalid-token",
          title: "title",
          body: "body",
          categoryId: PushCategoryId.reconstitute("TEST"),
          ...DELIVERY_OPTIONS,
        },
      ],
    ]);
    expect(await activeTokensOf(pushTokenRepository, ["user-1"])).toEqual([]);
    expect(pushTokenRepository.tokenOf("user-1", "device-invalid-token")?.updatedAt).toEqual(NOW);
    expect(pushTokenCache.invalidatedPushTokenUserIds).toEqual(["user-1"]);
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
      {
        token: "generic-token",
        status: "accepted",
        ticketId: PushTicketId.reconstitute("ticket-1"),
      },
      {
        token: "feature-token",
        status: "accepted",
        ticketId: PushTicketId.reconstitute("ticket-2"),
      },
    ];

    // When
    const prepared = await service.preparePushBatch.execute([
      batchPayload({ userId: "generic", dispatchId: 1 }),
      batchPayload({ userId: "feature", dispatchId: 2, requiresFeatureCapability: true }),
      batchPayload({ userId: "missing", dispatchId: 3 }),
      batchPayload({ userId: "unsupported", dispatchId: 4, requiresFeatureCapability: true }),
    ]);
    if (prepared.status !== "ready") {
      throw new Error("Expected a prepared batch delivery");
    }
    const result = await service.sendPushBatch.execute(prepared);

    // Then
    expect(pushProvider.sentBatches).toEqual([
      [
        {
          channel: "EXPO",
          token: "generic-token",
          title: "title-1",
          body: "body-1",
          data: { dispatchId: 1 },
          ...DELIVERY_OPTIONS,
        },
        {
          channel: "EXPO",
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
      {
        token: "generic-token",
        status: "accepted",
        ticketId: PushTicketId.reconstitute("ticket-1"),
      },
    ]);
    expect(result.resultsByDispatch.get(2)).toEqual([
      {
        token: "feature-token",
        status: "accepted",
        ticketId: PushTicketId.reconstitute("ticket-2"),
      },
    ]);
    expect(prepared.skippedDispatches).toEqual([
      { dispatchId: 3, reason: "NO_ACTIVE_TOKEN" },
      { dispatchId: 4, reason: "UNSUPPORTED_APP_CAPABILITY" },
    ]);
  });

  it("배치 invalid token은 기존 계약대로 배치 수신자 전체 token cache를 무효화한다", async () => {
    // Given
    const { service, pushTokenRepository, pushProvider, pushTokenCache } = createDispatchUseCase({
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
    });
    pushProvider.nextResults = async () => [
      { token: "invalid-token", status: "rejected", failure: { kind: "DEVICE_UNREGISTERED" } },
      {
        token: "valid-token",
        status: "accepted",
        ticketId: PushTicketId.reconstitute("ticket-valid"),
      },
    ];
    const prepared = await service.preparePushBatch.execute([
      batchPayload({ userId: "user-1", dispatchId: 1 }),
      batchPayload({ userId: "user-2", dispatchId: 2 }),
    ]);
    if (prepared.status !== "ready") {
      throw new Error("Expected a prepared batch delivery");
    }

    // When
    await service.sendPushBatch.execute(prepared);

    // Then
    expect(await activeTokensOf(pushTokenRepository, ["user-1", "user-2"])).toEqual([
      "valid-token",
    ]);
    expect(pushTokenCache.invalidatedPushTokenUserIds).toEqual(["user-1", "user-2"]);
  });

  it("배치 provider transport 오류는 token 상태를 변경하지 않고 같은 오류를 재전파한다", async () => {
    // Given
    const { service, pushTokenRepository, pushProvider, pushTokenCache } = createDispatchUseCase({
      activeTokens: [["user-1", ["ExponentPushToken[user-1]"]]],
      tokens: [
        pushToken({
          userId: "user-1",
          token: "ExponentPushToken[user-1]",
          payloadVersion: 2,
          appVersion: null,
        }),
      ],
    });
    const prepared = await service.preparePushBatch.execute([
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
    const result = service.sendPushBatch.execute(prepared);

    // Then
    await expect(result).rejects.toBe(transportError);
    expect(await activeTokensOf(pushTokenRepository, ["user-1"])).toEqual([
      "ExponentPushToken[user-1]",
    ]);
    expect(pushTokenCache.invalidatedPushTokenUserIds).toEqual([]);
  });
});

describe("푸시 배지 — 기기 앱 버전과 안 읽은 수", () => {
  const badgeDevices = [
    { token: "phone-token", channel: "EXPO", appVersion: "1.17.0" },
    { token: "tablet-token", channel: "EXPO", appVersion: "1.16.0" },
    { token: "mac-token", channel: "EXPO", appVersion: null },
  ] as const;

  it("단건은 배지를 다시 맞추는 앱 기기에만 받는 사람의 안 읽은 수를 싣는다", async () => {
    // Given
    const { service, pushProvider } = createDispatchUseCase({
      activeTokens: [["user-1", badgeDevices]],
      unreadCounts: [["user-1", 4]],
    });

    // When
    await service.dispatchPush.execute({
      data: createNotificationDraftFixture({ userId: "user-1", title: "title", body: "body" }),
      payload: { title: "title", body: "body", ...DELIVERY_OPTIONS },
    });

    // Then
    expect(pushProvider.getSentPayloads().map(({ token, badge }) => [token, badge])).toEqual([
      ["phone-token", 4],
      ["tablet-token", undefined],
      ["mac-token", undefined],
    ]);
  });

  it("단건 받는 사람의 기기가 모두 옛 앱이면 안 읽은 수를 세지 않는다", async () => {
    // Given
    const { service, unreadCounts } = createDispatchUseCase({
      activeTokens: [["user-1", badgeDevices.slice(1)]],
      unreadCounts: [["user-1", 4]],
    });

    // When
    await service.dispatchPush.execute({
      data: createNotificationDraftFixture({ userId: "user-1", title: "title", body: "body" }),
      payload: { title: "title", body: "body", ...DELIVERY_OPTIONS },
    });

    // Then
    expect(unreadCounts.requestedUserIds).toEqual([]);
  });

  it("배치는 배지를 실을 기기가 있는 사람만 한 번에 세고 안 읽은 알림이 없으면 0을 실어 배지를 지운다", async () => {
    // Given
    const { service, unreadCounts } = createDispatchUseCase({
      activeTokens: [
        ["user-1", badgeDevices],
        ["user-2", [{ token: "user-2-phone", channel: "EXPO", appVersion: "1.17.2" }]],
        ["user-3", ["user-3-old"]],
      ],
      unreadCounts: [["user-1", 4]],
    });

    // When
    const prepared = await service.preparePushBatch.execute([
      batchPayload({ userId: "user-1", dispatchId: 1 }),
      batchPayload({ userId: "user-2", dispatchId: 2 }),
      batchPayload({ userId: "user-3", dispatchId: 3 }),
    ]);

    // Then
    if (prepared.status !== "ready") {
      throw new Error("전송할 알림 배치가 필요합니다");
    }
    expect(unreadCounts.requestedUserIds).toEqual([["user-1", "user-2"]]);
    expect(prepared.messages.map(({ token, badge }) => [token, badge])).toEqual([
      ["phone-token", 4],
      ["tablet-token", undefined],
      ["mac-token", undefined],
      ["user-2-phone", 0],
      ["user-3-old", undefined],
    ]);
  });
});
