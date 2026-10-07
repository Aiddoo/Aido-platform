import { createHash } from "node:crypto";

import { vi } from "vitest";

import { ReconcilePushReceipts } from "#api/modules/notification/application/use-cases/delivery/reconcile-push-receipts.use-case";
import { PrismaPushDeliveryLifecycleRepository } from "#api/modules/notification/infrastructure/persistence/delivery/prisma-push-delivery-lifecycle.repository";
import { PrismaPushDeliveryOutboxRepository } from "#api/modules/notification/infrastructure/persistence/delivery/prisma-push-delivery-outbox.repository";
import { PrismaPushDispatchStagingRepository } from "#api/modules/notification/infrastructure/persistence/delivery/prisma-push-dispatch-staging.repository";
import { PrismaPushReceiptRepository } from "#api/modules/notification/infrastructure/persistence/delivery/prisma-push-receipt.repository";
import { PrismaPushTokenRepository } from "#api/modules/notification/infrastructure/persistence/delivery/prisma-push-token.repository";
import { decodeRecord, encodeCreate } from "#api/platform/database/database-records";
import { varchar } from "#api/platform/database/database-values";
import { requireRecord } from "#api/platform/database/prisma-error.util";
import { UserFixture } from "#test/fixtures/user.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const AT = new Date("2026-10-08T03:00:00.000Z");
const ACCEPTED_AT = new Date("2026-10-08T02:40:00.000Z");
const fingerprint = (token: string) => createHash("sha256").update(token).digest("hex");

describe("receipt 정합성 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let prisma: TestDatabaseClient;
  beforeAll(async () => {
    database = new TestDatabase();
    prisma = await database.start();
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
    options: { readonly acceptedAt?: Date; readonly legacy?: boolean } = {},
  ) {
    const user = UserFixture.create({
      email: `receipt-${suffix}@example.com`,
      userTag: suffix.padEnd(8, "X").slice(0, 8),
    });
    await prisma.orm.public.User.create(encodeCreate("User", user));
    const { txHost, uow } = createDatabaseTransactionFixture(prisma);
    const tokens = new PrismaPushTokenRepository(txHost);
    const receipts = new PrismaPushReceiptRepository(txHost);
    const token = await tokens.registerPushToken({
      userId: user.id,
      token: `ExponentPushToken[${suffix}-old]`,
      deviceId: "device",
      platform: "IOS",
    });
    const notification = decodeRecord(
      "Notification",
      await prisma.orm.public.Notification.create(
        encodeCreate("Notification", {
          userId: user.id,
          type: "SYSTEM_NOTICE",
          title: "fixture",
          body: "fixture",
        }),
      ),
    );
    const dispatch = decodeRecord(
      "PushDispatch",
      await prisma.orm.public.PushDispatch.create(
        encodeCreate("PushDispatch", {
          notificationId: notification.id,
          userId: user.id,
          purpose: "TRANSACTIONAL",
          status: "SENT",
        }),
      ),
    );
    const attempt = decodeRecord(
      "PushDeliveryAttempt",
      await prisma.orm.public.PushDeliveryAttempt.create(
        encodeCreate("PushDeliveryAttempt", {
          dispatchId: dispatch.id,
          pushTokenId: token.id,
          tokenFingerprint: options.legacy === true ? null : fingerprint(token.token),
          status: "TICKET_ACCEPTED",
          expoTicketId: `ticket-${suffix}`,
          createdAt: options.acceptedAt ?? ACCEPTED_AT,
        }),
      ),
    );
    return {
      user,
      token,
      notification,
      dispatch,
      attempt,
      tokens,
      receipts,
      txHost,
      uow,
      ticketId: `ticket-${suffix}`,
    };
  }

  async function readAttempt(ticketId: string) {
    return decodeRecord(
      "PushDeliveryAttempt",
      requireRecord(
        await prisma.orm.public.PushDeliveryAttempt.where((row) =>
          row.expoTicketId.eq(varchar(ticketId, 100)),
        ).first(),
      ),
    );
  }

  it("이전 토큰의 지연 invalid receipt는 같은 기기의 새 토큰을 비활성화하지 않는다", async () => {
    // Given
    const f = await fixture("rotation");
    await f.tokens.registerPushToken({
      userId: f.user.id,
      token: "ExponentPushToken[rotation-new]",
      deviceId: "device",
      platform: "IOS",
    });
    // When
    const invalid = await f.receipts.recordPushReceipts([
      { ticketId: f.ticketId, delivered: false, errorCode: "DeviceNotRegistered" },
    ]);
    await f.tokens.deactivateInvalidTokens(invalid.map((item) => item.token));
    // Then
    expect(invalid).toEqual([]);
    expect(await f.tokens.findPushTokensByUser({ userId: f.user.id })).toEqual([
      expect.objectContaining({
        id: f.token.id,
        token: "ExponentPushToken[rotation-new]",
        isActive: true,
      }),
    ]);
    expect((await readAttempt(f.ticketId)).status).toBe("FAILED");
  });

  it("발송 당시 토큰이 그대로인 invalid receipt만 비활성화 대상과 소유자를 반환한다", async () => {
    // Given
    const f = await fixture("same");
    // When
    const invalid = await f.receipts.recordPushReceipts([
      { ticketId: f.ticketId, delivered: false, errorCode: "DeviceNotRegistered" },
    ]);
    await f.tokens.deactivateInvalidTokens(invalid.map((item) => item.token));
    // Then
    expect(invalid).toEqual([{ userId: f.user.id, token: f.token.token }]);
    expect(await f.tokens.findPushTokensByUser({ userId: f.user.id, activeOnly: true })).toEqual(
      [],
    );
  });

  it("receipt 확인 뒤 등록이 토큰을 회전해도 이전 문자열의 비활성화는 새 토큰을 건드리지 않는다", async () => {
    // Given
    const f = await fixture("between");
    const invalid = await f.receipts.recordPushReceipts([
      { ticketId: f.ticketId, delivered: false, errorCode: "DeviceNotRegistered" },
    ]);
    // When
    await f.tokens.registerPushToken({
      userId: f.user.id,
      token: "ExponentPushToken[between-new]",
      deviceId: "device",
      platform: "IOS",
    });
    const result = await f.tokens.deactivateInvalidTokens(invalid.map((item) => item.token));
    // Then
    expect(result.count).toBe(0);
    expect(await f.tokens.findPushTokensByUser({ userId: f.user.id, activeOnly: true })).toEqual([
      expect.objectContaining({ token: "ExponentPushToken[between-new]" }),
    ]);
  });

  it("fingerprint 없는 기존 이력은 상태만 반영하고 현재 토큰을 추측해 비활성화하지 않는다", async () => {
    // Given
    const f = await fixture("legacy", { legacy: true });
    // When
    const invalid = await f.receipts.recordPushReceipts([
      { ticketId: f.ticketId, delivered: false, errorCode: "DeviceNotRegistered" },
    ]);
    // Then
    expect(invalid).toEqual([]);
    expect((await readAttempt(f.ticketId)).status).toBe("FAILED");
    expect(
      await f.tokens.findPushTokensByUser({ userId: f.user.id, activeOnly: true }),
    ).toHaveLength(1);
  });

  it("이미 확인된 delivered receipt는 뒤늦은 중복 오류로 되돌아가지 않는다", async () => {
    // Given
    const f = await fixture("delivered");
    await f.receipts.recordPushReceipts([{ ticketId: f.ticketId, delivered: true }]);
    // When
    const replay = await f.receipts.recordPushReceipts([
      { ticketId: f.ticketId, delivered: false, errorCode: "DeviceNotRegistered" },
    ]);
    // Then
    expect(replay).toEqual([]);
    expect((await readAttempt(f.ticketId)).status).toBe("DELIVERED");
  });

  it("이미 실패한 receipt도 중복 성공 응답으로 되돌아가지 않는다", async () => {
    // Given
    const f = await fixture("failed");
    await f.receipts.recordPushReceipts([
      { ticketId: f.ticketId, delivered: false, errorCode: "MessageTooBig" },
    ]);
    // When
    await f.receipts.recordPushReceipts([{ ticketId: f.ticketId, delivered: true }]);
    // Then
    expect(await readAttempt(f.ticketId)).toMatchObject({
      status: "FAILED",
      errorCode: "MessageTooBig",
    });
  });

  it("24시간 지난 missing ticket이 조회 가능한 새 receipt의 batch를 점유하지 않는다", async () => {
    // Given
    const old = await fixture("old", { acceptedAt: new Date("2026-10-07T01:00:00.000Z") });
    const recent = await fixture("recent");
    // When
    const pending = await old.receipts.findPendingPushReceipts(1);
    // Then
    expect(pending.map((item) => item.ticketId)).toEqual([recent.ticketId]);
  });

  it("15분 이전 ticket은 대기하고 15분 경계 ticket부터 조회한다", async () => {
    // Given
    const waiting = await fixture("waiting", { acceptedAt: new Date("2026-10-08T02:59:00.000Z") });
    const ready = await fixture("ready", { acceptedAt: new Date("2026-10-08T02:45:00.000Z") });
    // When
    const pending = await waiting.receipts.findPendingPushReceipts(900);
    // Then
    expect(pending.map((item) => item.ticketId)).toEqual([ready.ticketId]);
  });

  it("실제 outbox claim·finalize는 토큰 원문 대신 발송 토큰의 SHA256을 저장한다", async () => {
    // Given: 실제 일반 delivery staging/outbox/claim 경로.
    const f = await fixture("finalize");
    const notification = decodeRecord(
      "Notification",
      await prisma.orm.public.Notification.create(
        encodeCreate("Notification", {
          userId: f.user.id,
          type: "SYSTEM_NOTICE",
          title: "새 알림",
          body: "새 본문",
        }),
      ),
    );
    const staging = new PrismaPushDispatchStagingRepository(f.txHost);
    const outbox = new PrismaPushDeliveryOutboxRepository(f.txHost);
    const lifecycle = new PrismaPushDeliveryLifecycleRepository(f.txHost);
    const staged = await f.uow.run(() =>
      staging.stage({
        notificationId: notification.id,
        userId: f.user.id,
        purpose: "TRANSACTIONAL",
        deliveryMode: "SINGLE",
        force: false,
      }),
    );
    const publications = await f.uow.run(() => outbox.claimByDispatchIds([staged.dispatchId], AT));
    const claimed = await f.uow.run(() =>
      lifecycle.claim({
        publications,
        processingJobId: "receipt-finalize-job",
        processingJobAttempt: 1,
        startedAt: AT,
      }),
    );
    const claim = requireRecord(claimed[0]);
    // When: 공급자 ticket 결과를 기존 fence와 함께 저장한다.
    const count = await f.uow.run(() =>
      lifecycle.finalizeResults([
        {
          fence: claim.fence,
          context: { timezone: "UTC", localDate: new Date("2026-10-08T00:00:00.000Z") },
          results: [{ token: f.token.token, success: true, ticketId: "finalized-ticket" }],
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
    // Given: 실제 receipt 저장 뒤 token 단계에서 FK 오류가 발생한다.
    const f = await fixture("rollback");
    let failOnce = true;
    const requests: string[][] = [];
    const reconciler = new ReconcilePushReceipts({
      pushReceiptRepository: f.receipts,
      pushTokenRepository: {
        async deactivateInvalidTokens(tokens) {
          if (failOnce) {
            failOnce = false;
            await f.txHost.tx.orm.public.Notification.create(
              encodeCreate("Notification", {
                userId: "missing-receipt-user",
                type: "SYSTEM_NOTICE",
                title: "fixture",
                body: "fixture",
              }),
            );
          }
          return f.tokens.deactivateInvalidTokens(tokens);
        },
      },
      pushProvider: {
        async getReceipts(ticketIds) {
          requests.push(ticketIds);
          return ticketIds.map((ticketId) => ({
            ticketId,
            delivered: false,
            errorCode: "DeviceNotRegistered",
          }));
        },
      },
      unitOfWork: f.uow,
      cache: { async invalidatePushTokens() {} },
      logger: { log() {}, warn() {} },
    });
    // When: 실패한 DB 단계를 새 실행으로 다시 시도한다.
    await expect(reconciler.execute()).rejects.toMatchObject({ sqlState: "23503" });
    const afterFailure = await readAttempt(f.ticketId);
    await reconciler.execute();
    // Then: 첫 receipt는 pending으로 복원되고 재실행은 token까지 반영한다.
    expect.soft(afterFailure.status).toBe("TICKET_ACCEPTED");
    expect.soft(requests).toEqual([[f.ticketId], [f.ticketId]]);
    expect
      .soft(await f.tokens.findPushTokensByUser({ userId: f.user.id, activeOnly: true }))
      .toEqual([]);
    expect((await readAttempt(f.ticketId)).status).toBe("FAILED");
  });
});
