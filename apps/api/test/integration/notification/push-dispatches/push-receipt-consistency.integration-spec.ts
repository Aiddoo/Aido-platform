import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";
import { vi } from "vitest";

import type { PushTokenReadModel } from "#api/modules/notification/push-devices/application/read-models/push-token.read-model";
import { DrizzlePushDeviceRepository } from "#api/modules/notification/push-devices/infrastructure/persistence/drizzle-push-device.repository";
import { DrizzlePushTokenRepository } from "#api/modules/notification/push-devices/infrastructure/persistence/drizzle-push-token.repository";
import type { PushChannelRegistryPort } from "#api/modules/notification/push-dispatches/application/ports/push-channel-registry.port";
import type { PushReceiptResult } from "#api/modules/notification/push-dispatches/application/ports/push-channel.port";
import { ReconcilePushReceiptsUseCase } from "#api/modules/notification/push-dispatches/application/use-cases/reconcile-push-receipts.use-case";
import { PushDeliveryJobId } from "#api/modules/notification/push-dispatches/domain/push-delivery-job-id.vo";
import { PushDispatchId } from "#api/modules/notification/push-dispatches/domain/push-dispatch-id.vo";
import { pushReceiptCheckWindow } from "#api/modules/notification/push-dispatches/domain/push-receipt.domain-service";
import { PushTicketId } from "#api/modules/notification/push-dispatches/domain/push-ticket-id.vo";
import { EXPO_PUSH_CHANNEL_CONFIG } from "#api/modules/notification/push-dispatches/infrastructure/adapters/expo-push-channel.constants";
import { DrizzlePushDeliveryOutboxRepository } from "#api/modules/notification/push-dispatches/infrastructure/persistence/drizzle-push-delivery-outbox.repository";
import { DrizzlePushReceiptRepository } from "#api/modules/notification/push-dispatches/infrastructure/persistence/drizzle-push-receipt.repository";
import { databaseSqlState, requireRecord } from "#api/platform/database/database-error.util";
import {
  notification as notificationTable,
  pushDeliveryAttempt,
  pushDispatch,
  pushToken as pushTokenTable,
  user as userTable,
} from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  FakePushChannel,
  pushChannelRegistryOf,
} from "#test/doubles/notification/fake-push-channel";
import { DateClock } from "#test/doubles/platform/date-clock";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { createUserRowFixture } from "#test/fixtures/identity/user-row.fixture";
import {
  createRegisteringPushDeviceFixture,
  type PushTokenRegistrationFixture,
} from "#test/fixtures/notification/push-token.fixture";
import { nowInstant } from "#test/fixtures/platform/clock.fixture";
import { createPushDeliveryLifecycle } from "#test/integration/helpers/push-delivery-lifecycle";
import { createPushDispatchStaging } from "#test/integration/helpers/push-dispatch-staging";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const AT = new Date("2026-10-08T03:00:00.000Z");
const AT_INSTANT = Temporal.Instant.from(AT.toISOString());
const ACCEPTED_AT = Temporal.Instant.from("2026-10-08T02:40:00.000Z");
const fingerprint = (token: string) => createHash("sha256").update(token).digest("hex");
const unregistered = (ticketId: string): PushReceiptResult => ({
  ticketId: PushTicketId.reconstitute(ticketId),
  status: "failed",
  failure: { kind: "DEVICE_UNREGISTERED", providerCode: "DeviceNotRegistered" },
});
const delivered = (ticketId: string): PushReceiptResult => ({
  ticketId: PushTicketId.reconstitute(ticketId),
  status: "delivered",
});
const payloadTooLarge = (ticketId: string): PushReceiptResult => ({
  ticketId: PushTicketId.reconstitute(ticketId),
  status: "failed",
  failure: { kind: "PAYLOAD_TOO_LARGE", providerCode: "MessageTooBig" },
});

// 토큰은 기기 보고로 등록한다. 같은 사용자·기기에 다른 토큰을 보고하면 그 행의 토큰이 바뀐다
async function registerToken(
  transactionHost: ConstructorParameters<typeof DrizzlePushDeviceRepository>[0],
  registration: Partial<PushTokenRegistrationFixture>,
): Promise<PushTokenReadModel> {
  const device = createRegisteringPushDeviceFixture(registration);
  await new DrizzlePushDeviceRepository(transactionHost).save(device);
  const records = await new DrizzlePushTokenRepository(transactionHost).listPushTokensByUser({
    userId: device.userId,
  });
  const record = records.find((item) => item.deviceId === device.id.value);
  if (record == null) {
    throw new Error("push token fixture 누락");
  }
  return record;
}

// receipt 결과만 정해 둔 대역 채널 하나로 레지스트리를 만든다
function receiptChannel(
  readReceipts: (ticketIds: readonly PushTicketId[]) => Promise<PushReceiptResult[]>,
): PushChannelRegistryPort {
  const channel = new FakePushChannel();
  channel.receipts = readReceipts;
  return pushChannelRegistryOf(channel);
}

describe("receipt 정합성 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });
  afterAll(async () => {
    await database?.stop();
  });
  beforeEach(async () => {
    await database.cleanup();
    vi.setSystemTime(AT);
  });
  afterEach(() => vi.useRealTimers());

  async function fixture(
    suffix: string,
    options: { readonly acceptedAt?: Temporal.Instant; readonly legacy?: boolean } = {},
  ) {
    const user = createUserRowFixture({
      email: `receipt-${suffix}@example.com`,
      userTag: suffix.padEnd(8, "X").slice(0, 8),
    });
    await client.insert(userTable).values(user);
    const { transactionHost, uow } = createDatabaseTransactionFixture(client);
    const tokens = new DrizzlePushTokenRepository(transactionHost);
    const receipts = new DrizzlePushReceiptRepository(transactionHost, new DateClock());
    const token = await registerToken(transactionHost, {
      userId: user.id,
      token: `ExponentPushToken[${suffix}-old]`,
      deviceId: `device-${suffix}`,
      platform: "IOS",
      sessionId: null,
      payloadVersion: 1,
      appVersion: null,
      registeredAt: AT_INSTANT,
    });
    const [notification] = await client
      .insert(notificationTable)
      .values({ userId: user.id, type: "SYSTEM_NOTICE", title: "fixture", body: "fixture" })
      .returning();
    const [dispatch] = await client
      .insert(pushDispatch)
      .values({
        notificationId: requireRecord(notification).id,
        userId: user.id,
        purpose: "TRANSACTIONAL",
        status: "SENT",
        updatedAt: nowInstant(),
      })
      .returning();
    const [attempt] = await client
      .insert(pushDeliveryAttempt)
      .values({
        dispatchId: requireRecord(dispatch).id,
        pushTokenId: token.id,
        tokenFingerprint: options.legacy === true ? null : fingerprint(token.token),
        status: "TICKET_ACCEPTED",
        providerTicketId: `ticket-${suffix}`,
        createdAt: options.acceptedAt ?? ACCEPTED_AT,
        updatedAt: nowInstant(),
      })
      .returning();
    return {
      user,
      token,
      notification: requireRecord(notification),
      dispatch: requireRecord(dispatch),
      attempt: requireRecord(attempt),
      tokens,
      receipts,
      transactionHost,
      uow,
      ticketId: `ticket-${suffix}`,
    };
  }

  function record(
    f: { readonly receipts: DrizzlePushReceiptRepository },
    results: readonly PushReceiptResult[],
  ) {
    return f.receipts.recordPushReceipts({
      requestedTicketIds: results.map(({ ticketId }) => ticketId),
      results,
      checkedAt: AT_INSTANT,
    });
  }

  async function readAttempt(ticketId: string) {
    return requireRecord(
      await client.query.pushDeliveryAttempt.findFirst({ where: { providerTicketId: ticketId } }),
    );
  }

  it("이전 토큰의 지연 invalid receipt는 같은 기기의 새 토큰을 비활성화하지 않는다", async () => {
    // Given
    const f = await fixture("rotation");
    await registerToken(f.transactionHost, {
      userId: f.user.id,
      token: "ExponentPushToken[rotation-new]",
      deviceId: f.token.deviceId,
      platform: "IOS",
      sessionId: null,
      payloadVersion: 1,
      appVersion: null,
      registeredAt: AT_INSTANT,
    });

    // When
    const invalid = await record(f, [unregistered(f.ticketId)]);
    await f.tokens.deactivateInvalidTokens(
      invalid.map((item) => item.token),
      AT_INSTANT,
    );

    // Then
    expect(invalid).toEqual([]);
    expect(await f.tokens.listPushTokensByUser({ userId: UserId.reconstitute(f.user.id) })).toEqual(
      [
        expect.objectContaining({
          id: f.token.id,
          token: "ExponentPushToken[rotation-new]",
          isActive: true,
        }),
      ],
    );
    expect((await readAttempt(f.ticketId)).status).toBe("FAILED");
  });

  it("발송 당시 토큰이 그대로인 invalid receipt만 비활성화 대상과 소유자를 반환한다", async () => {
    // Given
    const f = await fixture("same");

    // When
    const invalid = await record(f, [unregistered(f.ticketId)]);
    await f.tokens.deactivateInvalidTokens(
      invalid.map((item) => item.token),
      AT_INSTANT,
    );

    // Then
    expect(invalid).toEqual([{ userId: UserId.reconstitute(f.user.id), token: f.token.token }]);
    expect(
      await f.tokens.listPushTokensByUser({
        userId: UserId.reconstitute(f.user.id),
        activeOnly: true,
      }),
    ).toEqual([]);
  });

  it("receipt 확인 뒤 등록이 토큰을 회전해도 이전 문자열의 비활성화는 새 토큰을 건드리지 않는다", async () => {
    // Given
    const f = await fixture("between");
    const invalid = await record(f, [unregistered(f.ticketId)]);

    // When
    await registerToken(f.transactionHost, {
      userId: f.user.id,
      token: "ExponentPushToken[between-new]",
      deviceId: f.token.deviceId,
      platform: "IOS",
      sessionId: null,
      payloadVersion: 1,
      appVersion: null,
      registeredAt: AT_INSTANT,
    });
    const result = await f.tokens.deactivateInvalidTokens(
      invalid.map((item) => item.token),
      AT_INSTANT,
    );

    // Then
    expect(result.count).toBe(0);
    expect(
      await f.tokens.listPushTokensByUser({
        userId: UserId.reconstitute(f.user.id),
        activeOnly: true,
      }),
    ).toEqual([expect.objectContaining({ token: "ExponentPushToken[between-new]" })]);
  });

  it("fingerprint 없는 기존 이력은 상태만 반영하고 현재 토큰을 추측해 비활성화하지 않는다", async () => {
    // Given
    const f = await fixture("legacy", { legacy: true });

    // When
    const invalid = await record(f, [unregistered(f.ticketId)]);

    // Then
    expect(invalid).toEqual([]);
    expect((await readAttempt(f.ticketId)).status).toBe("FAILED");
    expect(
      await f.tokens.listPushTokensByUser({
        userId: UserId.reconstitute(f.user.id),
        activeOnly: true,
      }),
    ).toHaveLength(1);
  });

  it("이미 확인된 delivered receipt는 뒤늦은 중복 오류로 되돌아가지 않는다", async () => {
    // Given
    const f = await fixture("delivered");
    await record(f, [delivered(f.ticketId)]);

    // When
    const replay = await record(f, [unregistered(f.ticketId)]);

    // Then
    expect(replay).toEqual([]);
    expect((await readAttempt(f.ticketId)).status).toBe("DELIVERED");
  });

  it("이미 실패한 receipt도 중복 성공 응답으로 되돌아가지 않는다", async () => {
    // Given
    const f = await fixture("failed");
    await record(f, [payloadTooLarge(f.ticketId)]);

    // When
    await record(f, [delivered(f.ticketId)]);

    // Then
    expect(await readAttempt(f.ticketId)).toMatchObject({
      status: "FAILED",
      failureKind: "PAYLOAD_TOO_LARGE",
      errorCode: "MessageTooBig",
    });
  });

  it("24시간 지난 missing ticket이 조회 가능한 새 receipt의 batch를 점유하지 않는다", async () => {
    // Given
    const old = await fixture("old", {
      acceptedAt: Temporal.Instant.from("2026-10-07T01:00:00.000Z"),
    });
    const recent = await fixture("recent");

    // When
    const pending = await old.receipts.findPendingTicketIds({
      channel: "EXPO",
      window: pushReceiptCheckWindow(AT_INSTANT, EXPO_PUSH_CHANNEL_CONFIG.timing.receipt),
      limit: 1,
    });

    // Then
    expect(pending.map((ticketId) => ticketId.value)).toEqual([recent.ticketId]);
  });

  it("receipt 확인과 만료는 그 채널 토큰으로 보낸 ticket만 고른다", async () => {
    // Given
    const otherChannel = await fixture("other");
    await client
      .update(pushTokenTable)
      .set({ provider: "WEB_PUSH" })
      .where(eq(pushTokenTable.id, otherChannel.token.id));
    const expo = await fixture("expo");
    const window = pushReceiptCheckWindow(AT_INSTANT, EXPO_PUSH_CHANNEL_CONFIG.timing.receipt);

    // When
    const pending = await expo.receipts.findPendingTicketIds({
      channel: "EXPO",
      window,
      limit: 900,
    });
    const closed = await expo.receipts.expireUnreceipted({
      channel: "EXPO",
      acceptedBefore: AT_INSTANT,
      limit: 100,
    });

    // Then
    expect(pending.map((ticketId) => ticketId.value)).toEqual([expo.ticketId]);
    expect(closed).toBe(1);
    expect((await readAttempt(otherChannel.ticketId)).status).toBe("TICKET_ACCEPTED");
  });

  it("15분 이전 ticket은 대기하고 15분 경계 ticket부터 조회한다", async () => {
    // Given
    const waiting = await fixture("waiting", {
      acceptedAt: Temporal.Instant.from("2026-10-08T02:59:00.000Z"),
    });
    const ready = await fixture("ready", {
      acceptedAt: Temporal.Instant.from("2026-10-08T02:45:00.000Z"),
    });

    // When
    const pending = await waiting.receipts.findPendingTicketIds({
      channel: "EXPO",
      window: pushReceiptCheckWindow(AT_INSTANT, EXPO_PUSH_CHANNEL_CONFIG.timing.receipt),
      limit: 900,
    });

    // Then
    expect(pending.map((ticketId) => ticketId.value)).toEqual([ready.ticketId]);
  });

  it("5분마다 도는 receipt 확인은 수락 15분 전 ticket을 묻지 않고 15분이 된 다음 실행에서 묻는다", async () => {
    // Given
    // 03:00 실행 10분 전에 수락된 ticket
    const f = await fixture("cadence", {
      acceptedAt: Temporal.Instant.from("2026-10-08T02:50:00.000Z"),
    });
    const clock = new FixedClock(AT_INSTANT);
    const requests: string[][] = [];
    const reconciler = new ReconcilePushReceiptsUseCase({
      pushReceiptRepository: f.receipts,
      pushTokenRepository: f.tokens,
      channels: receiptChannel(async (ticketIds) => {
        requests.push(ticketIds.map((ticketId) => ticketId.value));
        return ticketIds.map((ticketId) => delivered(ticketId.value));
      }),
      unitOfWork: f.uow,
      cache: { async invalidatePushTokens() {} },
      clock,
      logger: { log() {}, warn() {} },
      alert: { raise() {} },
    });

    // When
    await reconciler.execute();
    const atFirstRun = requests.length;
    clock.advanceBy({ minutes: 5 });
    await reconciler.execute();

    // Then
    expect(atFirstRun).toBe(0);
    expect(requests).toEqual([[f.ticketId]]);
    expect((await readAttempt(f.ticketId)).status).toBe("DELIVERED");
  });

  it("아직 결과가 없는 ticket은 확인 시각만 남겨 다른 ticket보다 뒤로 미룬다", async () => {
    // Given
    // 가장 오래된 ticket의 receipt가 아직 오지 않는다
    const stuck = await fixture("stuck", {
      acceptedAt: Temporal.Instant.from("2026-10-08T01:00:00.000Z"),
    });
    const next = await fixture("next");

    // When
    await stuck.receipts.recordPushReceipts({
      requestedTicketIds: [PushTicketId.reconstitute(stuck.ticketId)],
      results: [],
      checkedAt: AT_INSTANT,
    });
    const pending = await stuck.receipts.findPendingTicketIds({
      channel: "EXPO",
      window: pushReceiptCheckWindow(AT_INSTANT, EXPO_PUSH_CHANNEL_CONFIG.timing.receipt),
      limit: 1,
    });

    // Then
    expect(pending.map((ticketId) => ticketId.value)).toEqual([next.ticketId]);
    expect(await readAttempt(stuck.ticketId)).toMatchObject({
      status: "TICKET_ACCEPTED",
      receiptCheckedAt: AT_INSTANT,
    });
  });

  it("보관 기간 안에 receipt가 오지 않은 ticket은 결과 미상으로 닫는다", async () => {
    // Given
    const expired = await fixture("expired", {
      acceptedAt: Temporal.Instant.from("2026-10-07T01:00:00.000Z"),
    });
    const fresh = await fixture("fresh");

    // When
    const closed = await expired.receipts.expireUnreceipted({
      channel: "EXPO",
      acceptedBefore: pushReceiptCheckWindow(AT_INSTANT, EXPO_PUSH_CHANNEL_CONFIG.timing.receipt)
        .acceptedAfter,
      limit: 100,
    });

    // Then
    expect(closed).toBe(1);
    expect(await readAttempt(expired.ticketId)).toMatchObject({
      status: "UNKNOWN",
      failureKind: "RECEIPT_EXPIRED",
    });
    expect((await readAttempt(fresh.ticketId)).status).toBe("TICKET_ACCEPTED");
  });

  it("실제 outbox claim·finalize는 토큰 원문 대신 발송 토큰의 SHA256을 저장한다", async () => {
    // Given
    const f = await fixture("finalize");
    const [created] = await client
      .insert(notificationTable)
      .values({ userId: f.user.id, type: "SYSTEM_NOTICE", title: "새 알림", body: "새 본문" })
      .returning();
    const notification = requireRecord(created);
    const staging = createPushDispatchStaging(f.transactionHost, new DateClock());
    const outbox = new DrizzlePushDeliveryOutboxRepository(f.transactionHost, new DateClock());
    const lifecycle = createPushDeliveryLifecycle(f.transactionHost, new DateClock());
    const staged = await f.uow.run(() =>
      staging.stage({
        notificationId: notification.id,
        userId: f.user.id,
        purpose: "TRANSACTIONAL",
        deliveryMode: "SINGLE",
        force: false,
      }),
    );
    const publications = await f.uow.run(() =>
      outbox.claimByDispatchIds([PushDispatchId.reconstitute(staged.dispatchId)], AT_INSTANT),
    );
    const claimed = await f.uow.run(() =>
      lifecycle.claim({
        publications,
        processingJobId: PushDeliveryJobId.reconstitute("receipt-finalize-job"),
        processingJobAttempt: 1,
        startedAt: AT_INSTANT,
      }),
    );
    const claim = requireRecord(claimed[0]);

    // When
    const count = await f.uow.run(() =>
      lifecycle.finalizeResults([
        {
          fence: claim.fence,
          context: { timezone: "UTC", localDate: Temporal.PlainDate.from("2026-10-08") },
          results: [
            {
              token: f.token.token,
              status: "accepted",
              ticketId: PushTicketId.reconstitute("finalized-ticket"),
            },
          ],
        },
      ]),
    );

    // Then
    expect(count).toBe(1);
    expect(await readAttempt("finalized-ticket")).toMatchObject({
      status: "TICKET_ACCEPTED",
      tokenFingerprint: fingerprint(f.token.token),
      pushTokenId: f.token.id,
    });
  });
  it("token 비활성화 DB 실패는 receipt도 rollback하고 다음 실행에서 다시 처리한다", async () => {
    // Given
    const f = await fixture("rollback");
    let failOnce = true;
    const requests: string[][] = [];
    const reconciler = new ReconcilePushReceiptsUseCase({
      pushReceiptRepository: f.receipts,
      pushTokenRepository: {
        async deactivateInvalidTokens(tokens, deactivatedAt) {
          if (failOnce) {
            failOnce = false;
            await f.transactionHost.tx.insert(notificationTable).values({
              userId: "missing-receipt-user",
              type: "SYSTEM_NOTICE",
              title: "fixture",
              body: "fixture",
            });
          }
          return f.tokens.deactivateInvalidTokens(tokens, deactivatedAt);
        },
      },
      channels: receiptChannel(async (ticketIds) => {
        requests.push(ticketIds.map((ticketId) => ticketId.value));
        return ticketIds.map((ticketId) => unregistered(ticketId.value));
      }),
      unitOfWork: f.uow,
      cache: { async invalidatePushTokens() {} },
      clock: new FixedClock(AT_INSTANT),
      logger: { log() {}, warn() {} },
      alert: { raise() {} },
    });

    // When
    await expect(reconciler.execute()).rejects.toSatisfy(
      (error: unknown) => databaseSqlState(error) === "23503",
    );
    const afterFailure = await readAttempt(f.ticketId);
    await reconciler.execute();

    // Then
    expect.soft(afterFailure.status).toBe("TICKET_ACCEPTED");
    expect.soft(requests).toEqual([[f.ticketId], [f.ticketId]]);
    expect
      .soft(
        await f.tokens.listPushTokensByUser({
          userId: UserId.reconstitute(f.user.id),
          activeOnly: true,
        }),
      )
      .toEqual([]);
    expect((await readAttempt(f.ticketId)).status).toBe("FAILED");
  });
});
