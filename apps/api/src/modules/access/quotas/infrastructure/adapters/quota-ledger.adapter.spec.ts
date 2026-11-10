import { ErrorCode } from "@aido/api/errors";
import { PLAN_CATALOG, PLAN_FEATURE_KEYS } from "@aido/api/vocabulary";

import { QUOTA_LEDGER_TIME, createQuotaLedgerFixture } from "#test/fixtures/quota-ledger.fixture";

import {
  QUOTA_ABANDONED_REFUND_BATCH_SIZE,
  QUOTA_RESERVATION_TAKEOVER_AFTER_MS,
  QUOTA_STALE_RESERVATION_ALERT_AFTER_MS,
} from "../../domain/quotas.constants.js";

const FREE_AI_LIMIT = PLAN_CATALOG.AI_PARSE.free;
const FREE_VOICE_LIMIT = PLAN_CATALOG.VOICE_NOTE.free;
const NEXT_RESET = "2026-04-30T15:00:00.000Z";

type Fixture = ReturnType<typeof createQuotaLedgerFixture>;

function reserve(
  fixture: Fixture,
  input: { feature?: "AI_PARSE" | "VOICE_NOTE"; idempotencyKey?: string | null } = {},
) {
  return fixture.ledger.reserve({
    userId: fixture.userId,
    feature: input.feature ?? "AI_PARSE",
    idempotencyKey: input.idempotencyKey ?? null,
    reason: "parse-todo",
  });
}

describe("QuotaLedgerAdapter", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(QUOTA_LEDGER_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("예약·확정·환불", () => {
    it("예약은 즉시 사용량을 차감하고 같은 기간 환불은 정확히 한 번만 되돌린다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture({ aiUsageCount: 2 });

      // When
      const reservation = await reserve(fixture);
      const reserved = await fixture.ledger.read(fixture.userId, "AI_PARSE");
      const first = await fixture.ledger.refund(reservation, "FAILED");
      const second = await fixture.ledger.refund(reservation, "FAILED");

      // Then
      expect(reserved.used).toBe(3);
      expect([first, second]).toEqual([true, false]);
      expect((await fixture.ledger.read(fixture.userId, "AI_PARSE")).used).toBe(2);
      expect(reservation).toEqual({
        chargeId: "charge-1",
        userId: fixture.userId,
        feature: "AI_PARSE",
        attempt: 1,
        isAlreadyCommitted: false,
      });
      expect(Object.isFrozen(reservation)).toBe(true);
      expect(fixture.repository.charges.get("charge-1")).toMatchObject({
        meter: "AI_PLAN",
        idempotencyKey: null,
        status: "REFUNDED",
        reason: "parse-todo",
        refundReason: "FAILED",
        periodKey: "2026-M04",
      });
    });

    it("확정한 차감은 환불해도 사용량이 그대로다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture();
      const reservation = await reserve(fixture);

      // When
      const committed = await fixture.ledger.commit(reservation);
      const refunded = await fixture.ledger.refund(reservation, "FAILED");

      // Then
      expect([committed, refunded]).toEqual([true, false]);
      expect((await fixture.ledger.read(fixture.userId, "AI_PARSE")).used).toBe(1);
      expect(fixture.repository.charges.get(reservation.chargeId)?.status).toBe("COMMITTED");
    });

    it("기간이 바뀐 뒤 첫 예약은 지난 사용량을 버리고 1회로 시작한다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture({
        aiUsageCount: 5,
        aiUsageResetAt: new Date("2026-03-12T12:00:00Z"),
      });

      // When
      await reserve(fixture);

      // Then
      expect(fixture.repository.users.get(fixture.userId)).toMatchObject({
        aiUsageCount: 1,
        aiUsageResetAt: QUOTA_LEDGER_TIME,
      });
    });

    it("지난 달 예약의 환불은 새 달 사용량을 줄이지 않고 원장만 환불로 남긴다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture();
      const previous = await reserve(fixture);
      vi.setSystemTime(new Date("2026-04-30T15:00:00Z"));
      await reserve(fixture);

      // When
      const refunded = await fixture.ledger.refund(previous, "FAILED");

      // Then
      expect(refunded).toBe(true);
      expect(await fixture.ledger.read(fixture.userId, "AI_PARSE")).toMatchObject({
        used: 1,
        limit: FREE_AI_LIMIT,
        resetsAt: "2026-05-31T15:00:00.000Z",
      });
      expect(fixture.repository.charges.get(previous.chargeId)?.status).toBe("REFUNDED");
    });
  });

  describe("한도", () => {
    it("정확히 한도에 닿은 예약은 차감 없이 AI_1303과 서버가 계산한 featureQuota를 준다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture({ aiUsageCount: FREE_AI_LIMIT });

      // When
      const execution = reserve(fixture);

      // Then
      await expect(execution).rejects.toMatchObject({
        errorCode: ErrorCode.AI_1303,
        details: {
          charged: false,
          featureQuota: {
            feature: "AI_PARSE",
            allowed: true,
            limit: FREE_AI_LIMIT,
            used: FREE_AI_LIMIT,
            remaining: 0,
            period: "month",
            resetsAt: NEXT_RESET,
            isFairUse: false,
            perUse: null,
          },
        },
      });
      expect(fixture.repository.users.get(fixture.userId)?.aiUsageCount).toBe(FREE_AI_LIMIT);
      expect(fixture.repository.charges.size).toBe(0);
      expect(fixture.ledgerLogger.warn).toHaveBeenCalledWith({
        event: "access.quota.exhausted",
        meter: "AI_PLAN",
        tier: "FREE",
      });
    });

    it("ADMIN은 공정 사용 상한도 넘어 예약할 수 있다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture({
        role: "ADMIN",
        aiUsageCount: PLAN_CATALOG.AI_PARSE.fairUse.premium,
      });

      // When
      await reserve(fixture);

      // Then
      expect(await fixture.ledger.read(fixture.userId, "AI_PARSE")).toMatchObject({
        used: PLAN_CATALOG.AI_PARSE.fairUse.premium + 1,
        limit: null,
        remaining: null,
      });
    });

    it("프리미엄은 무료 한도를 넘어 쓰고 공정 사용 상한에서 AI_1303으로 막힌다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture({
        subscriptionStatus: "ACTIVE",
        aiUsageCount: PLAN_CATALOG.AI_PARSE.fairUse.premium - 1,
      });

      // When
      await reserve(fixture);
      const exhausted = reserve(fixture);

      // Then
      await expect(exhausted).rejects.toMatchObject({
        errorCode: ErrorCode.AI_1303,
        details: {
          charged: false,
          featureQuota: { limit: PLAN_CATALOG.AI_PARSE.fairUse.premium, isFairUse: true },
        },
      });
    });

    it("프리미엄이 끝난 직후에는 공정 사용 상한이 아니라 무료 한도로 막는다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture({
        subscriptionStatus: "ACTIVE",
        accessDeadline: new Date(QUOTA_LEDGER_TIME.getTime() + 1),
        aiUsageCount: FREE_AI_LIMIT,
      });
      await reserve(fixture);
      vi.setSystemTime(new Date(QUOTA_LEDGER_TIME.getTime() + 1));

      // When
      const afterExpiry = reserve(fixture);

      // Then
      await expect(afterExpiry).rejects.toMatchObject({
        errorCode: ErrorCode.AI_1303,
        details: { featureQuota: { limit: FREE_AI_LIMIT, used: FREE_AI_LIMIT + 1, remaining: 0 } },
      });
    });

    it("이미 한도를 넘긴 다운그레이드 사용자는 남은 횟수 0으로 막히고 사용량은 줄지 않는다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture({ aiUsageCount: FREE_AI_LIMIT + 20 });

      // When
      const execution = reserve(fixture);

      // Then
      await expect(execution).rejects.toMatchObject({
        errorCode: ErrorCode.AI_1303,
        details: { featureQuota: { used: FREE_AI_LIMIT + 20, remaining: 0 } },
      });
      expect(fixture.repository.users.get(fixture.userId)?.aiUsageCount).toBe(FREE_AI_LIMIT + 20);
    });

    it("녹음 정리는 AI 사용량과 따로 세고 무료 한도에서 AI_1313으로 막힌다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture({ aiUsageCount: 4 });
      for (let index = 0; index < FREE_VOICE_LIMIT; index += 1) {
        await reserve(fixture, { feature: "VOICE_NOTE" });
      }

      // When
      const exhausted = reserve(fixture, { feature: "VOICE_NOTE" });

      // Then
      await expect(exhausted).rejects.toMatchObject({
        errorCode: ErrorCode.AI_1313,
        details: {
          charged: false,
          featureQuota: {
            feature: "VOICE_NOTE",
            used: FREE_VOICE_LIMIT,
            remaining: 0,
            perUse: {
              maxSeconds: PLAN_CATALOG.VOICE_NOTE.perUse.maxSeconds.free,
              maxCharacters: PLAN_CATALOG.VOICE_NOTE.perUse.maxCharacters.free,
            },
          },
        },
      });
      expect((await fixture.ledger.read(fixture.userId, "AI_PARSE")).used).toBe(4);
    });
  });

  describe("같은 Idempotency-Key", () => {
    it("확정된 키를 다시 보내면 차감하지 않고 이미 확정됐다고 알린다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture();
      const first = await reserve(fixture, { feature: "VOICE_NOTE", idempotencyKey: "key-1" });
      await fixture.ledger.commit(first);

      // When
      const replay = await reserve(fixture, { feature: "VOICE_NOTE", idempotencyKey: "key-1" });
      const replayRefund = await fixture.ledger.refund(replay, "FAILED");

      // Then
      expect(replay).toMatchObject({ chargeId: first.chargeId, isAlreadyCommitted: true });
      expect(replayRefund).toBe(false);
      expect((await fixture.ledger.read(fixture.userId, "VOICE_NOTE")).used).toBe(1);
    });

    it("처리 중인 키를 다시 보내면 차감 없이 AI_1314로 충돌을 알린다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture();
      await reserve(fixture, { feature: "VOICE_NOTE", idempotencyKey: "key-1" });

      // When
      const execution = reserve(fixture, { feature: "VOICE_NOTE", idempotencyKey: "key-1" });

      // Then
      await expect(execution).rejects.toMatchObject({
        errorCode: ErrorCode.AI_1314,
        details: { charged: false, featureQuota: { feature: "VOICE_NOTE", used: 1 } },
      });
      expect((await fixture.ledger.read(fixture.userId, "VOICE_NOTE")).used).toBe(1);
    });

    it("환불된 키는 같은 행에서 다시 차감해 순 차감이 한 번이고 이전 시도의 늦은 환불은 무시한다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture();
      const first = await reserve(fixture, { feature: "VOICE_NOTE", idempotencyKey: "key-1" });
      await fixture.ledger.refund(first, "FAILED");

      // When
      const retry = await reserve(fixture, { feature: "VOICE_NOTE", idempotencyKey: "key-1" });
      const lateRefund = await fixture.ledger.refund(first, "FAILED");

      // Then
      expect(retry).toMatchObject({
        chargeId: first.chargeId,
        attempt: 2,
        isAlreadyCommitted: false,
      });
      expect(lateRefund).toBe(false);
      expect((await fixture.ledger.read(fixture.userId, "VOICE_NOTE")).used).toBe(1);
      expect(fixture.repository.charges.size).toBe(1);
    });

    it("응답하지 못하고 멈춘 예약은 같은 키 재시도가 추가 차감 없이 이어받는다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture();
      await reserve(fixture, { feature: "VOICE_NOTE", idempotencyKey: "key-1" });
      vi.setSystemTime(new Date(QUOTA_LEDGER_TIME.getTime() + QUOTA_RESERVATION_TAKEOVER_AFTER_MS));

      // When
      const takeover = await reserve(fixture, { feature: "VOICE_NOTE", idempotencyKey: "key-1" });

      // Then
      expect(takeover).toMatchObject({ attempt: 2, isAlreadyCommitted: false });
      expect((await fixture.ledger.read(fixture.userId, "VOICE_NOTE")).used).toBe(1);
    });

    it("키가 없는 출시 앱 요청도 요청마다 원장 행을 남긴다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture();

      // When
      await reserve(fixture);
      await reserve(fixture);

      // Then
      expect(
        [...fixture.repository.charges.values()].map((charge) => charge.idempotencyKey),
      ).toEqual([null, null]);
    });
  });

  describe("오류 격리·로그", () => {
    it("사용자가 사라지면 조회·예약은 USER_0601이고 환불은 false로 안전하게 끝난다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture();
      const reservation = await reserve(fixture);
      fixture.repository.users.clear();

      // When
      const read = fixture.ledger.read(fixture.userId, "AI_PARSE");
      const reserved = reserve(fixture);
      const refunded = await fixture.ledger.refund(reservation, "FAILED");

      // Then
      await expect(read).rejects.toMatchObject({ errorCode: ErrorCode.USER_0601 });
      await expect(reserved).rejects.toMatchObject({ errorCode: ErrorCode.USER_0601 });
      expect(refunded).toBe(false);
    });

    it("환불·확정 저장 오류는 원래 요청 오류를 덮지 않고 원문 없이 기록한다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture();
      const reservation = await reserve(fixture);
      vi.spyOn(fixture.repository, "updateCharge").mockRejectedValue(
        new Error("private database details"),
      );

      // When
      const refunded = await fixture.ledger.refund(reservation, "FAILED");
      const committed = await fixture.ledger.commit(reservation);

      // Then
      expect([refunded, committed]).toEqual([false, false]);
      expect((await fixture.ledger.read(fixture.userId, "AI_PARSE")).used).toBe(1);
      expect(fixture.ledgerLogger.error).toHaveBeenCalledWith({
        event: "access.quota.refund-failed",
        chargeId: reservation.chargeId,
        meter: "AI_PLAN",
        errorType: "Error",
      });
      expect(JSON.stringify(fixture.ledgerLogger.error.mock.calls)).not.toContain(
        "private database details",
      );
    });

    it("예약·확정·환불 로그는 chargeId·meter·reason만 남긴다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture();

      // When
      const committed = await reserve(fixture);
      await fixture.ledger.commit(committed);
      const refunded = await reserve(fixture);
      await fixture.ledger.refund(refunded, "NO_ACTION");

      // Then
      expect(fixture.ledgerLogger.log.mock.calls.map(([entry]) => entry)).toEqual([
        {
          event: "access.quota.reserved",
          chargeId: "charge-1",
          meter: "AI_PLAN",
          reason: "parse-todo",
        },
        {
          event: "access.quota.committed",
          chargeId: "charge-1",
          meter: "AI_PLAN",
          reason: "parse-todo",
        },
        {
          event: "access.quota.reserved",
          chargeId: "charge-2",
          meter: "AI_PLAN",
          reason: "parse-todo",
        },
        {
          event: "access.quota.refunded",
          chargeId: "charge-2",
          meter: "AI_PLAN",
          reason: "NO_ACTION",
        },
      ]);
    });
  });

  describe("멈춘 예약 정리", () => {
    it("이어받을 시간이 지난 예약만 돌려주고 완료 수를 남긴다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture();
      await reserve(fixture);
      vi.setSystemTime(QUOTA_LEDGER_TIME.getTime() + QUOTA_RESERVATION_TAKEOVER_AFTER_MS - 1);
      await reserve(fixture);
      vi.setSystemTime(QUOTA_LEDGER_TIME.getTime() + QUOTA_RESERVATION_TAKEOVER_AFTER_MS);

      // When
      await fixture.ledger.refundAbandonedReservations();

      // Then
      expect((await fixture.ledger.read(fixture.userId, "AI_PARSE")).used).toBe(1);
      expect(fixture.repository.charges.get("charge-1")).toMatchObject({
        status: "REFUNDED",
        refundReason: "ABANDONED",
      });
      expect(fixture.repository.charges.get("charge-2")).toMatchObject({ status: "RESERVED" });
      expect(fixture.ledgerLogger.log).toHaveBeenCalledWith({
        event: "access.quota.abandoned-refund.completed",
        candidateCount: 1,
        refundedCount: 1,
        failedCount: 0,
        staleCount: 0,
        clearedHashCount: 0,
      });
      expect(fixture.alert.raise).not.toHaveBeenCalled();
    });

    it("30분 넘게 남은 예약이 있으면 사람에게 알린다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture();
      await reserve(fixture);
      vi.setSystemTime(QUOTA_LEDGER_TIME.getTime() + QUOTA_STALE_RESERVATION_ALERT_AFTER_MS);
      vi.spyOn(fixture.repository, "findAbandonedReservations").mockResolvedValue([]);

      // When
      await fixture.ledger.refundAbandonedReservations();

      // Then
      expect(fixture.alert.raise).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "access.quota.stale-reservation",
          details: { failedCount: 0, staleCount: 1 },
        }),
      );
    });

    it("다시 돌아도 한 번만 돌려주고 늦게 온 확정·환불은 아무것도 바꾸지 않는다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture({ aiUsageCount: 2 });
      const reservation = await reserve(fixture);
      vi.setSystemTime(QUOTA_LEDGER_TIME.getTime() + QUOTA_RESERVATION_TAKEOVER_AFTER_MS);

      // When
      await fixture.ledger.refundAbandonedReservations();
      await fixture.ledger.refundAbandonedReservations();
      const lateCommit = await fixture.ledger.commit(reservation);
      const lateRefund = await fixture.ledger.refund(reservation, "FAILED");

      // Then
      expect([lateCommit, lateRefund]).toEqual([false, false]);
      expect((await fixture.ledger.read(fixture.userId, "AI_PARSE")).used).toBe(2);
    });

    it("한 건의 저장 오류는 기록만 하고 다음 건을 계속 돌려준다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture();
      await reserve(fixture);
      await reserve(fixture);
      vi.setSystemTime(QUOTA_LEDGER_TIME.getTime() + QUOTA_RESERVATION_TAKEOVER_AFTER_MS);
      vi.spyOn(fixture.repository, "updateCharge").mockRejectedValueOnce(new TypeError("db down"));

      // When
      await fixture.ledger.refundAbandonedReservations();

      // Then
      expect(fixture.repository.charges.get("charge-2")).toMatchObject({ status: "REFUNDED" });
      expect(fixture.ledgerLogger.error).toHaveBeenCalledWith({
        event: "access.quota.refund-failed",
        chargeId: "charge-1",
        meter: "AI_PLAN",
        errorType: "TypeError",
      });
      expect(fixture.ledgerLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({ refundedCount: 1, failedCount: 1 }),
      );
    });

    it("한 번에 정해진 수만 돌려주고 남은 예약은 다음 주기에 돌려준다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture();
      const find = vi.spyOn(fixture.repository, "findAbandonedReservations");
      // When
      await fixture.ledger.refundAbandonedReservations();
      // Then
      expect(find).toHaveBeenCalledWith(
        new Date(QUOTA_LEDGER_TIME.getTime() - QUOTA_RESERVATION_TAKEOVER_AFTER_MS),
        QUOTA_ABANDONED_REFUND_BATCH_SIZE,
      );
    });
  });

  describe("권한 스냅샷", () => {
    it("모든 기능의 한도와 계량기·일간 사용량을 서버가 계산한다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture({ aiUsageCount: 3 });
      await reserve(fixture, { feature: "VOICE_NOTE" });
      const dailyResetsAt = new Date("2026-04-12T15:00:00Z");

      // When
      const snapshot = await fixture.ledger.readSnapshot(fixture.userId, {
        daily: {
          CHEER: { used: 2, resetsAt: dailyResetsAt },
          NUDGE: { used: 0, resetsAt: dailyResetsAt },
        },
        resourceCounts: { FRIEND: 1, TODO_CATEGORY: 2 },
      });

      // Then
      expect(snapshot).toMatchObject({ isPremium: false, tier: "FREE" });
      expect(Object.keys(snapshot.features)).toEqual([...PLAN_FEATURE_KEYS]);
      expect(snapshot.features.AI_PARSE).toMatchObject({ used: 3, resetsAt: NEXT_RESET });
      expect(snapshot.features.VOICE_NOTE).toMatchObject({
        used: 1,
        remaining: FREE_VOICE_LIMIT - 1,
      });
      expect(snapshot.features.CHEER).toMatchObject({
        limit: PLAN_CATALOG.CHEER.free,
        used: 2,
        remaining: PLAN_CATALOG.CHEER.free - 2,
        period: "day",
        resetsAt: "2026-04-12T15:00:00.000Z",
      });
      expect(snapshot.features.AI_REPORT).toMatchObject({ allowed: false, used: null });
    });

    function readResourceSnapshot(
      fixture: Fixture,
      resourceCounts: { readonly FRIEND: number; readonly TODO_CATEGORY: number },
    ) {
      const resetsAt = new Date("2026-04-12T15:00:00Z");
      return fixture.ledger.readSnapshot(fixture.userId, {
        daily: { CHEER: { used: 0, resetsAt }, NUDGE: { used: 0, resetsAt } },
        resourceCounts,
      });
    }

    it("무료 사용자가 카테고리·친구 한도에 닿으면 남은 자리가 0이고 초기화 시각은 없다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture();

      // When
      const snapshot = await readResourceSnapshot(fixture, {
        FRIEND: PLAN_CATALOG.FRIEND.free,
        TODO_CATEGORY: PLAN_CATALOG.TODO_CATEGORY.free,
      });

      // Then
      expect(snapshot.features.TODO_CATEGORY).toEqual({
        feature: "TODO_CATEGORY",
        allowed: true,
        limit: PLAN_CATALOG.TODO_CATEGORY.free,
        used: PLAN_CATALOG.TODO_CATEGORY.free,
        remaining: 0,
        period: null,
        resetsAt: null,
        isFairUse: false,
        perUse: null,
      });
      expect(snapshot.features.FRIEND).toMatchObject({
        limit: PLAN_CATALOG.FRIEND.free,
        used: PLAN_CATALOG.FRIEND.free,
        remaining: 0,
        resetsAt: null,
      });
    });

    it("한도보다 적으면 남은 자리를 주고, 한도를 넘게 가진 개수도 남은 자리는 0 아래로 내려가지 않는다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture();

      // When
      const snapshot = await readResourceSnapshot(fixture, {
        FRIEND: PLAN_CATALOG.FRIEND.free + 2,
        TODO_CATEGORY: 1,
      });

      // Then
      expect(snapshot.features.TODO_CATEGORY).toMatchObject({
        used: 1,
        remaining: PLAN_CATALOG.TODO_CATEGORY.free - 1,
      });
      expect(snapshot.features.FRIEND).toMatchObject({
        used: PLAN_CATALOG.FRIEND.free + 2,
        remaining: 0,
      });
    });

    it("친구 한도는 초대 보상 자리를 더한 한도로 남은 자리를 센다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture({}, { FRIEND: 2 });

      // When
      const snapshot = await readResourceSnapshot(fixture, {
        FRIEND: PLAN_CATALOG.FRIEND.free,
        TODO_CATEGORY: 0,
      });

      // Then
      expect(snapshot.features.FRIEND).toMatchObject({
        limit: PLAN_CATALOG.FRIEND.free + 2,
        used: PLAN_CATALOG.FRIEND.free,
        remaining: 2,
      });
    });

    it("프리미엄은 카테고리를 프리미엄 한도로 세고, 무제한인 친구는 개수를 싣지 않는다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture({ subscriptionStatus: "ACTIVE" });

      // When
      const snapshot = await readResourceSnapshot(fixture, {
        FRIEND: 12,
        TODO_CATEGORY: PLAN_CATALOG.TODO_CATEGORY.premium,
      });

      // Then
      expect(snapshot.features.TODO_CATEGORY).toMatchObject({
        limit: PLAN_CATALOG.TODO_CATEGORY.premium,
        used: PLAN_CATALOG.TODO_CATEGORY.premium,
        remaining: 0,
      });
      expect(snapshot.features.FRIEND).toMatchObject({
        allowed: true,
        limit: null,
        used: null,
        remaining: null,
        resetsAt: null,
      });
    });

    it("ADMIN은 카테고리·친구 모두 무제한이라 개수를 싣지 않는다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture({ role: "ADMIN" });

      // When
      const snapshot = await readResourceSnapshot(fixture, { FRIEND: 40, TODO_CATEGORY: 40 });

      // Then
      expect(snapshot.features.TODO_CATEGORY).toMatchObject({
        limit: null,
        used: null,
        remaining: null,
      });
      expect(snapshot.features.FRIEND).toMatchObject({ limit: null, used: null, remaining: null });
    });
  });

  describe("요청 지문과 달을 넘긴 이어받기", () => {
    function reserveVoice(fixture: Fixture, requestHash = "hash-a", reason = "voice-note-digest") {
      return fixture.ledger.reserve({
        userId: fixture.userId,
        feature: "VOICE_NOTE",
        idempotencyKey: "key-1",
        requestHash,
        reason,
      });
    }

    it.each([
      { name: "내용이 다른 요청", requestHash: "hash-b", reason: "voice-note-digest" },
      { name: "작업이 다른 요청", requestHash: "hash-a", reason: "other-task" },
    ])("같은 키의 $name은 AI_1318이고 차감하지 않는다", async ({ requestHash, reason }) => {
      // Given
      const fixture = createQuotaLedgerFixture();
      await reserveVoice(fixture);
      // When
      const reused = reserveVoice(fixture, requestHash, reason);
      // Then
      await expect(reused).rejects.toMatchObject({
        errorCode: ErrorCode.AI_1318,
        details: { charged: false },
      });
      expect((await fixture.ledger.read(fixture.userId, "VOICE_NOTE")).used).toBe(1);
    });

    it("환불한 요청도 내용이 다르면 같은 키를 다시 쓸 수 없다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture();
      await fixture.ledger.refund(await reserveVoice(fixture), "FAILED");
      // When
      const reused = reserveVoice(fixture, "hash-b");
      // Then
      await expect(reused).rejects.toMatchObject({ errorCode: ErrorCode.AI_1318 });
    });

    it("같은 달 이어받기는 사용량을 그대로 두고 시도만 올린다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture();
      await reserveVoice(fixture);
      vi.setSystemTime(QUOTA_LEDGER_TIME.getTime() + QUOTA_RESERVATION_TAKEOVER_AFTER_MS);
      // When
      const takenOver = await reserveVoice(fixture);
      // Then
      expect(takenOver.attempt).toBe(2);
      expect((await fixture.ledger.read(fixture.userId, "VOICE_NOTE")).used).toBe(1);
    });

    it("달을 넘겨 이어받으면 새 달 사용량으로 다시 잡고 지난달 몫을 돌려놓는다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture();
      await reserveVoice(fixture);
      const nextMonth = new Date(NEXT_RESET);
      vi.setSystemTime(nextMonth);
      // When
      const takenOver = await reserveVoice(fixture);
      // Then
      const [charge] = [...fixture.repository.charges.values()];
      expect(takenOver.attempt).toBe(2);
      expect(charge?.periodKey).toBe("2026-M05");
      expect(fixture.repository.usage.get(`${fixture.userId}:VOICE_NOTE:2026-M05`)).toBe(1);
      expect(fixture.repository.usage.get(`${fixture.userId}:VOICE_NOTE:2026-M04`)).toBe(0);
    });

    it("달을 넘겨 이어받은 뒤 환불은 새 달 사용량을 돌려준다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture();
      await reserveVoice(fixture);
      vi.setSystemTime(new Date(NEXT_RESET));
      const takenOver = await reserveVoice(fixture);
      // When
      const refunded = await fixture.ledger.refund(takenOver, "FAILED");
      // Then
      expect(refunded).toBe(true);
      expect((await fixture.ledger.read(fixture.userId, "VOICE_NOTE")).used).toBe(0);
    });

    it("달을 넘겨 이어받을 때 새 달 한도가 다 찼으면 막고 지난달 예약은 그대로 둔다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture();
      await reserveVoice(fixture);
      vi.setSystemTime(new Date(NEXT_RESET));
      fixture.repository.usage.set(`${fixture.userId}:VOICE_NOTE:2026-M05`, FREE_VOICE_LIMIT);
      // When
      const blocked = reserveVoice(fixture);
      // Then
      await expect(blocked).rejects.toMatchObject({ errorCode: ErrorCode.AI_1313 });
      const [charge] = [...fixture.repository.charges.values()];
      expect(charge?.status).toBe("RESERVED");
    });

    it("AI_PLAN도 달을 넘겨 이어받으면 새 달 사용량으로 다시 잡는다", async () => {
      // Given
      const fixture = createQuotaLedgerFixture({ aiUsageCount: 5 });
      await reserve(fixture, { idempotencyKey: "key-1" });
      vi.setSystemTime(new Date(NEXT_RESET));
      // When
      await reserve(fixture, { idempotencyKey: "key-1" });
      // Then
      expect((await fixture.ledger.read(fixture.userId, "AI_PARSE")).used).toBe(1);
    });
  });
});
