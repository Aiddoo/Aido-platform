import { QUOTA_RESERVATION_TAKEOVER_AFTER_MS } from "../../constants/quotas/quota.constants.js";
import { QuotaCharge, type QuotaChargeProps } from "./quota-charge.aggregate.js";

const AT = new Date("2026-04-12T12:00:00Z");

function charge(overrides: Partial<QuotaChargeProps> = {}): QuotaCharge {
  return QuotaCharge.reconstitute({
    ...QuotaCharge.planReservation({
      requestHash: null,
      userId: "user",
      meter: "VOICE_NOTE",
      idempotencyKey: "key-1",
      reason: "voice-note-digest",
      periodKey: "2026-M04",
      at: AT,
    }),
    id: "charge-1",
    createdAt: AT,
    ...overrides,
  });
}

describe("QuotaCharge", () => {
  it("새 예약은 RESERVED 첫 시도로 한 회를 차감한다", () => {
    // Given
    const draft = QuotaCharge.planReservation({
      requestHash: null,
      userId: "user",
      meter: "AI_PLAN",
      idempotencyKey: null,
      reason: "parse-todo",
      periodKey: "2026-M04",
      at: AT,
    });

    // When
    const planned = QuotaCharge.reconstitute({ ...draft, id: "charge-1", createdAt: AT });

    // Then
    expect(planned).toMatchObject({
      status: "RESERVED",
      attempt: 1,
      amount: 1,
      refundReason: null,
    });
  });

  it("환불은 정확히 한 번만 바뀌고 두 번째 환불과 확정은 false다", () => {
    // Given
    const reserved = charge();

    // When
    const first = reserved.refund({ attempt: 1, reason: "FAILED", at: AT });
    const second = reserved.refund({ attempt: 1, reason: "NO_ACTION", at: AT });
    const commit = reserved.commit(1, AT);

    // Then
    expect([first, second, commit]).toEqual([true, false, false]);
    expect(reserved).toMatchObject({ status: "REFUNDED", refundReason: "FAILED" });
  });

  it("확정한 차감은 환불되지 않는다", () => {
    // Given
    const reserved = charge();

    // When
    const committed = reserved.commit(1, AT);
    const refunded = reserved.refund({ attempt: 1, reason: "FAILED", at: AT });

    // Then
    expect([committed, refunded]).toEqual([true, false]);
    expect(reserved.status).toBe("COMMITTED");
  });

  it("이전 시도의 늦은 확정·환불은 새 시도를 바꾸지 않는다", () => {
    // Given
    const reserved = charge({ status: "REFUNDED", refundReason: "FAILED" });
    reserved.reserveAgain({ reason: "voice-note-digest", periodKey: "2026-M04", at: AT });

    // When
    const lateRefund = reserved.refund({ attempt: 1, reason: "FAILED", at: AT });
    const lateCommit = reserved.commit(1, AT);

    // Then
    expect([lateRefund, lateCommit]).toEqual([false, false]);
    expect(reserved).toMatchObject({ status: "RESERVED", attempt: 2, refundReason: null });
  });

  it.each([
    { status: "COMMITTED", ageMs: 0, replay: "COMMITTED" },
    { status: "REFUNDED", ageMs: 0, replay: "RETRY" },
    { status: "RESERVED", ageMs: QUOTA_RESERVATION_TAKEOVER_AFTER_MS - 1, replay: "IN_FLIGHT" },
    { status: "RESERVED", ageMs: QUOTA_RESERVATION_TAKEOVER_AFTER_MS, replay: "TAKE_OVER" },
  ] as const)(
    "같은 키의 $status 차감(경과 $ageMs ms)은 $replay 로 판단한다",
    ({ status, ageMs, replay }) => {
      // Given
      const existing = charge({ status });

      // When
      const decision = existing.replayAt(new Date(AT.getTime() + ageMs));

      // Then
      expect(decision).toBe(replay);
    },
  );

  it("다시 예약은 환불된 차감에서만, 이어받기는 멈춘 예약에서만 바뀐다", () => {
    // Given
    const fresh = charge();
    const committed = charge({ status: "COMMITTED" });
    const stale = charge();
    const later = new Date(AT.getTime() + QUOTA_RESERVATION_TAKEOVER_AFTER_MS);

    // When
    const reservedAgain = fresh.reserveAgain({ reason: "x", periodKey: "2026-M04", at: AT });
    const committedAgain = committed.reserveAgain({ reason: "x", periodKey: "2026-M04", at: AT });
    const freshTakeOver = fresh.takeOver({ periodKey: "2026-M04", at: AT });
    const staleTakeOver = stale.takeOver({ periodKey: "2026-M04", at: later });

    // Then
    expect([reservedAgain, committedAgain, freshTakeOver, staleTakeOver]).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(stale).toMatchObject({ status: "RESERVED", attempt: 2, updatedAt: later });
  });

  it("복원 입력의 Date를 바꿔도 내부 시각은 바뀌지 않는다", () => {
    // Given
    const updatedAt = new Date(AT);
    const restored = charge({ updatedAt });

    // When
    updatedAt.setUTCFullYear(2000);
    restored.updatedAt.setUTCFullYear(2001);

    // Then
    expect(restored.updatedAt).toEqual(AT);
  });

  it("끝내 응답하지 못한 예약은 이어받을 시간이 지난 뒤에만 돌려주고 사유를 남긴다", () => {
    // Given
    const reserved = charge();
    const justBefore = new Date(AT.getTime() + QUOTA_RESERVATION_TAKEOVER_AFTER_MS - 1);
    const after = new Date(AT.getTime() + QUOTA_RESERVATION_TAKEOVER_AFTER_MS);

    // When
    const early = reserved.refundAbandoned(justBefore);
    const late = reserved.refundAbandoned(after);
    const again = reserved.refundAbandoned(after);

    // Then
    expect([early, late, again]).toEqual([false, true, false]);
    expect(reserved).toMatchObject({ status: "REFUNDED", refundReason: "ABANDONED" });
  });

  it("확정한 차감은 오래돼도 돌려주지 않는다", () => {
    // Given
    const committed = charge();
    committed.commit(1, AT);

    // When
    const refunded = committed.refundAbandoned(new Date(AT.getTime() + 86_400_000));

    // Then
    expect(refunded).toBe(false);
    expect(committed.status).toBe("COMMITTED");
  });

  it("같은 작업·같은 지문이어야 같은 요청이다", () => {
    // Given
    const charge = QuotaCharge.reconstitute({
      ...QuotaCharge.planReservation({
        userId: "user-1",
        meter: "VOICE_NOTE",
        idempotencyKey: "key",
        requestHash: "hash-a",
        reason: "voice-note-digest",
        periodKey: "2026-M04",
        at: AT,
      }),
      id: "charge-1",
      createdAt: AT,
    });
    // When
    const results = [
      charge.isSameRequest({ reason: "voice-note-digest", requestHash: "hash-a" }),
      charge.isSameRequest({ reason: "voice-note-digest", requestHash: "hash-b" }),
      charge.isSameRequest({ reason: "quick-plan", requestHash: "hash-a" }),
      charge.isSameRequest({ reason: "voice-note-digest", requestHash: null }),
    ];
    // Then
    expect(results).toEqual([true, false, false, false]);
  });
});
