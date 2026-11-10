import { ErrorCode } from "@aido/api/errors";
import { PLAN_CATALOG, type MeteredFeatureKey } from "@aido/api/vocabulary";

import { FixedClock } from "#test/doubles/platform/fixed-clock";
import {
  ACCESS_FIXTURE_NOW,
  type AccessUserInput,
} from "#test/fixtures/access/access-user.fixture";
import { createQuotaLedgerFixture } from "#test/fixtures/access/quota-ledger.fixture";

import { QUOTA_RESERVATION_TAKEOVER_AFTER_MS } from "../../domain/quotas.constants.js";

const FREE_AI_LIMIT = PLAN_CATALOG.AI_PARSE.free;
const FREE_VOICE_LIMIT = PLAN_CATALOG.VOICE_NOTE.free;
const AI_FAIR_USE = PLAN_CATALOG.AI_PARSE.fairUse.premium;
// KST 2026-05-01 00:00. ACCESS_FIXTURE_NOW(4월)의 다음 리셋이다
const NEXT_MONTH = Temporal.Instant.from("2026-04-30T15:00:00Z");

function setup(input: AccessUserInput = {}) {
  const clock = new FixedClock(ACCESS_FIXTURE_NOW);
  const fixture = createQuotaLedgerFixture(input, undefined, { clock });
  const reserve = (
    options: {
      readonly feature?: MeteredFeatureKey;
      readonly idempotencyKey?: string | null;
      readonly requestHash?: string;
      readonly reason?: string;
    } = {},
  ) =>
    fixture.ledger.reserve({
      userId: fixture.userId,
      feature: options.feature ?? "AI_PARSE",
      idempotencyKey: options.idempotencyKey ?? null,
      requestHash: options.requestHash,
      reason: options.reason ?? "parse-todo",
    });
  const used = async (feature: MeteredFeatureKey) =>
    (await fixture.ledger.read(fixture.userId, feature)).used;
  const moveTo = (instant: Temporal.Instant) =>
    clock.advanceBy({ milliseconds: instant.epochMilliseconds - clock.now().epochMilliseconds });
  return { ...fixture, clock, reserve, used, moveTo };
}

describe("ReserveQuotaUseCase — 횟수 예약", () => {
  describe("기간", () => {
    it("기간이 바뀐 뒤 첫 예약은 지난 사용량을 버리고 1회로 시작하고 그 시각을 새 기간 시작으로 남긴다", async () => {
      // Given
      const fixture = setup({
        aiUsageCount: 5,
        aiUsageResetAt: Temporal.Instant.from("2026-03-12T12:00:00Z"),
      });

      // When
      await fixture.reserve();

      // Then
      const user = fixture.users.get(fixture.userId);
      expect(user?.aiUsageCount).toBe(1);
      expect(user?.aiUsageResetAt.equals(ACCESS_FIXTURE_NOW)).toBe(true);
    });

    it("키가 없는 출시 앱 요청도 요청마다 원장 행을 남긴다", async () => {
      // Given
      const fixture = setup();

      // When
      await fixture.reserve();
      await fixture.reserve();

      // Then
      expect(fixture.quotaChargeRepository.all.map((charge) => charge.idempotencyKey)).toEqual([
        null,
        null,
      ]);
    });
  });

  describe("한도", () => {
    it("정확히 한도에 닿은 예약은 차감 없이 AI_1303과 서버가 계산한 featureQuota를 준다", async () => {
      // Given
      const fixture = setup({ aiUsageCount: FREE_AI_LIMIT });

      // When
      const execution = fixture.reserve();

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
            resetsAt: "2026-04-30T15:00:00.000Z",
            isFairUse: false,
            perUse: null,
          },
        },
      });
      expect(fixture.users.get(fixture.userId)?.aiUsageCount).toBe(FREE_AI_LIMIT);
      expect(fixture.quotaChargeRepository.all).toHaveLength(0);
      expect(fixture.logger.messages).toContainEqual({
        event: "access.quota.exhausted",
        meter: "AI_PLAN",
        plan: "free",
      });
    });

    it.each([
      { case: "구독 없는 ADMIN", user: { role: "ADMIN" } },
      { case: "구독 중인 ADMIN", user: { role: "ADMIN", subscriptionStatus: "ACTIVE" } },
      {
        case: "구독이 지금 끝난 ADMIN",
        user: { role: "ADMIN", subscriptionStatus: "ACTIVE", accessDeadline: ACCESS_FIXTURE_NOW },
      },
      {
        case: "구독이 1ms 전에 끝난 ADMIN",
        user: {
          role: "ADMIN",
          subscriptionStatus: "ACTIVE",
          accessDeadline: ACCESS_FIXTURE_NOW.subtract({ milliseconds: 1 }),
        },
      },
    ] as const)(
      "$case도 프리미엄과 같은 AI·녹음 공정 사용 상한에서 같은 오류로 막힌다",
      async ({ user }) => {
        // Given
        const voiceFairUse = PLAN_CATALOG.VOICE_NOTE.fairUse.premium;
        const fixture = setup({ ...user, aiUsageCount: AI_FAIR_USE - 1 });
        fixture.quotaUsageRepository.setUsage({
          userId: fixture.userId,
          meter: "VOICE_NOTE",
          periodKey: "2026-M04",
          used: voiceFairUse,
        });

        // When
        await fixture.reserve();
        const aiExhausted = fixture.reserve();
        const voiceExhausted = fixture.reserve({ feature: "VOICE_NOTE", reason: "voice-note" });

        // Then
        await expect(aiExhausted).rejects.toMatchObject({
          errorCode: ErrorCode.AI_1303,
          details: {
            charged: false,
            featureQuota: {
              limit: AI_FAIR_USE,
              used: AI_FAIR_USE,
              remaining: 0,
              isFairUse: true,
              resetsAt: NEXT_MONTH.toString({ fractionalSecondDigits: 3 }),
            },
          },
        });
        await expect(voiceExhausted).rejects.toMatchObject({
          errorCode: ErrorCode.AI_1313,
          details: {
            charged: false,
            featureQuota: {
              limit: voiceFairUse,
              used: voiceFairUse,
              remaining: 0,
              isFairUse: true,
            },
          },
        });
      },
    );

    it("프리미엄은 무료 한도를 넘어 쓰고 공정 사용 상한에서 AI_1303으로 막힌다", async () => {
      // Given
      const fixture = setup({ subscriptionStatus: "ACTIVE", aiUsageCount: AI_FAIR_USE - 1 });

      // When
      await fixture.reserve();
      const exhausted = fixture.reserve();

      // Then
      await expect(exhausted).rejects.toMatchObject({
        errorCode: ErrorCode.AI_1303,
        details: { charged: false, featureQuota: { limit: AI_FAIR_USE, isFairUse: true } },
      });
    });

    it("프리미엄이 끝나는 시각부터는 공정 사용 상한이 아니라 무료 한도로 막는다", async () => {
      // Given
      const fixture = setup({
        subscriptionStatus: "ACTIVE",
        accessDeadline: ACCESS_FIXTURE_NOW.add({ milliseconds: 1 }),
        aiUsageCount: FREE_AI_LIMIT,
      });
      await fixture.reserve();
      fixture.clock.advanceBy({ milliseconds: 1 });

      // When
      const afterExpiry = fixture.reserve();

      // Then
      await expect(afterExpiry).rejects.toMatchObject({
        errorCode: ErrorCode.AI_1303,
        details: { featureQuota: { limit: FREE_AI_LIMIT, used: FREE_AI_LIMIT + 1, remaining: 0 } },
      });
    });

    it("이미 한도를 넘긴 다운그레이드 사용자는 남은 횟수 0으로 막히고 사용량은 줄지 않는다", async () => {
      // Given
      const fixture = setup({ aiUsageCount: FREE_AI_LIMIT + 20 });

      // When
      const execution = fixture.reserve();

      // Then
      await expect(execution).rejects.toMatchObject({
        errorCode: ErrorCode.AI_1303,
        details: { featureQuota: { used: FREE_AI_LIMIT + 20, remaining: 0 } },
      });
      expect(fixture.users.get(fixture.userId)?.aiUsageCount).toBe(FREE_AI_LIMIT + 20);
    });

    it("녹음 정리는 AI 사용량과 따로 세고 무료 한도에서 AI_1313으로 막힌다", async () => {
      // Given
      const fixture = setup({ aiUsageCount: 4 });
      for (let index = 0; index < FREE_VOICE_LIMIT; index += 1) {
        await fixture.reserve({ feature: "VOICE_NOTE" });
      }

      // When
      const exhausted = fixture.reserve({ feature: "VOICE_NOTE" });

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
      expect(await fixture.used("AI_PARSE")).toBe(4);
    });

    it("사용자가 없으면 차감하지 않고 USER_0601이다", async () => {
      // Given
      const fixture = setup();
      fixture.users.clear();

      // When
      const execution = fixture.reserve();

      // Then
      await expect(execution).rejects.toMatchObject({
        errorCode: ErrorCode.USER_0601,
        details: { userId: fixture.userId },
      });
      expect(fixture.quotaChargeRepository.all).toHaveLength(0);
    });
  });

  describe("같은 Idempotency-Key", () => {
    it("확정된 키를 다시 보내면 차감하지 않고 이미 확정됐다고 알린다", async () => {
      // Given
      const fixture = setup();
      const first = await fixture.reserve({ feature: "VOICE_NOTE", idempotencyKey: "key-1" });
      await fixture.ledger.commit(first);

      // When
      const replay = await fixture.reserve({ feature: "VOICE_NOTE", idempotencyKey: "key-1" });
      const replayRefund = await fixture.ledger.refund(replay, "FAILED");

      // Then
      expect(replay).toMatchObject({ chargeId: first.chargeId, isAlreadyCommitted: true });
      expect(replayRefund).toBe(false);
      expect(await fixture.used("VOICE_NOTE")).toBe(1);
    });

    it("처리 중인 키를 다시 보내면 차감 없이 AI_1314로 충돌을 알린다", async () => {
      // Given
      const fixture = setup();
      await fixture.reserve({ feature: "VOICE_NOTE", idempotencyKey: "key-1" });

      // When
      const execution = fixture.reserve({ feature: "VOICE_NOTE", idempotencyKey: "key-1" });

      // Then
      await expect(execution).rejects.toMatchObject({
        errorCode: ErrorCode.AI_1314,
        details: { charged: false, featureQuota: { feature: "VOICE_NOTE", used: 1 } },
      });
      expect(await fixture.used("VOICE_NOTE")).toBe(1);
    });

    it("환불된 키는 같은 행에서 다시 차감해 순 차감이 한 번이고 이전 시도의 늦은 환불은 무시한다", async () => {
      // Given
      const fixture = setup();
      const first = await fixture.reserve({ feature: "VOICE_NOTE", idempotencyKey: "key-1" });
      await fixture.ledger.refund(first, "FAILED");

      // When
      const retry = await fixture.reserve({ feature: "VOICE_NOTE", idempotencyKey: "key-1" });
      const lateRefund = await fixture.ledger.refund(first, "FAILED");

      // Then
      expect(retry).toMatchObject({
        chargeId: first.chargeId,
        attempt: 2,
        isAlreadyCommitted: false,
      });
      expect(lateRefund).toBe(false);
      expect(await fixture.used("VOICE_NOTE")).toBe(1);
      expect(fixture.quotaChargeRepository.all).toHaveLength(1);
    });

    it("응답하지 못하고 멈춘 예약은 같은 키 재시도가 추가 차감 없이 이어받는다", async () => {
      // Given
      const fixture = setup();
      await fixture.reserve({ feature: "VOICE_NOTE", idempotencyKey: "key-1" });
      fixture.clock.advanceBy({ milliseconds: QUOTA_RESERVATION_TAKEOVER_AFTER_MS });

      // When
      const takeover = await fixture.reserve({ feature: "VOICE_NOTE", idempotencyKey: "key-1" });

      // Then
      expect(takeover).toMatchObject({ attempt: 2, isAlreadyCommitted: false });
      expect(await fixture.used("VOICE_NOTE")).toBe(1);
    });

    it("이어받기 1ms 전에는 아직 처리 중으로 본다", async () => {
      // Given
      const fixture = setup();
      await fixture.reserve({ feature: "VOICE_NOTE", idempotencyKey: "key-1" });
      fixture.clock.advanceBy({ milliseconds: QUOTA_RESERVATION_TAKEOVER_AFTER_MS - 1 });

      // When
      const execution = fixture.reserve({ feature: "VOICE_NOTE", idempotencyKey: "key-1" });

      // Then
      await expect(execution).rejects.toMatchObject({ errorCode: ErrorCode.AI_1314 });
    });
  });

  describe("요청 지문과 달을 넘긴 이어받기", () => {
    function reserveVoice(
      fixture: ReturnType<typeof setup>,
      requestHash = "hash-a",
      reason = "voice-note-digest",
    ) {
      return fixture.reserve({
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
      const fixture = setup();
      await reserveVoice(fixture);

      // When
      const reused = reserveVoice(fixture, requestHash, reason);

      // Then
      await expect(reused).rejects.toMatchObject({
        errorCode: ErrorCode.AI_1318,
        details: { charged: false },
      });
      expect(await fixture.used("VOICE_NOTE")).toBe(1);
    });

    it("환불한 요청도 내용이 다르면 같은 키를 다시 쓸 수 없다", async () => {
      // Given
      const fixture = setup();
      await fixture.ledger.refund(await reserveVoice(fixture), "FAILED");

      // When
      const reused = reserveVoice(fixture, "hash-b");

      // Then
      await expect(reused).rejects.toMatchObject({ errorCode: ErrorCode.AI_1318 });
    });

    it("같은 달 이어받기는 사용량을 그대로 두고 시도만 올린다", async () => {
      // Given
      const fixture = setup();
      await reserveVoice(fixture);
      fixture.clock.advanceBy({ milliseconds: QUOTA_RESERVATION_TAKEOVER_AFTER_MS });

      // When
      const takenOver = await reserveVoice(fixture);

      // Then
      expect(takenOver.attempt).toBe(2);
      expect(await fixture.used("VOICE_NOTE")).toBe(1);
    });

    it("달을 넘겨 이어받으면 새 달 사용량으로 다시 잡고 지난달 몫을 돌려놓는다", async () => {
      // Given
      const fixture = setup();
      await reserveVoice(fixture);
      fixture.moveTo(NEXT_MONTH);

      // When
      const takenOver = await reserveVoice(fixture);

      // Then
      const [charge] = fixture.quotaChargeRepository.all;
      expect(takenOver.attempt).toBe(2);
      expect(charge?.periodKey).toBe("2026-M05");
      expect(await fixture.used("VOICE_NOTE")).toBe(1);
      fixture.moveTo(ACCESS_FIXTURE_NOW);
      expect(await fixture.used("VOICE_NOTE")).toBe(0);
    });

    it("달을 넘겨 이어받은 뒤 환불은 새 달 사용량을 돌려준다", async () => {
      // Given
      const fixture = setup();
      await reserveVoice(fixture);
      fixture.moveTo(NEXT_MONTH);
      const takenOver = await reserveVoice(fixture);

      // When
      const refunded = await fixture.ledger.refund(takenOver, "FAILED");

      // Then
      expect(refunded).toBe(true);
      expect(await fixture.used("VOICE_NOTE")).toBe(0);
    });

    it("달을 넘겨 이어받을 때 새 달 한도가 다 찼으면 막고 지난달 예약은 그대로 둔다", async () => {
      // Given
      const fixture = setup();
      await reserveVoice(fixture);
      fixture.moveTo(NEXT_MONTH);
      fixture.quotaUsageRepository.setUsage({
        userId: fixture.userId,
        meter: "VOICE_NOTE",
        periodKey: "2026-M05",
        used: FREE_VOICE_LIMIT,
      });

      // When
      const blocked = reserveVoice(fixture);

      // Then
      await expect(blocked).rejects.toMatchObject({ errorCode: ErrorCode.AI_1313 });
      expect(fixture.quotaChargeRepository.all).toMatchObject([
        { status: "RESERVED", attempt: 1, periodKey: "2026-M04" },
      ]);
    });

    it("AI_PLAN도 달을 넘겨 이어받으면 새 달 사용량으로 다시 잡는다", async () => {
      // Given
      const fixture = setup({ aiUsageCount: 5 });
      await fixture.reserve({ idempotencyKey: "key-1" });
      fixture.moveTo(NEXT_MONTH);

      // When
      await fixture.reserve({ idempotencyKey: "key-1" });

      // Then
      expect(await fixture.used("AI_PARSE")).toBe(1);
    });
  });
});
