import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  ACCESS_FIXTURE_NOW,
  ACCESS_FIXTURE_USER_ID,
} from "#test/fixtures/access/access-user.fixture";
import { createQuotaChargeFixture } from "#test/fixtures/access/quota-charge.fixture";

import { QuotaWindow } from "../../shared/domain/quota-window.vo.js";
import { QuotaChargeId } from "./quota-charge-id.vo.js";
import { QuotaCharge } from "./quota-charge.aggregate.js";
import { QUOTA_RESERVATION_TAKEOVER_AFTER_MS } from "./quotas.constants.js";

const NOW = ACCESS_FIXTURE_NOW;
const WINDOW = QuotaWindow.create(NOW);
const TAKEOVER_AT = NOW.add({ milliseconds: QUOTA_RESERVATION_TAKEOVER_AFTER_MS });

describe("QuotaCharge — 차감 한 건", () => {
  it("새 예약은 RESERVED 첫 시도로 그 기간에 한 회를 차감한다", () => {
    // When
    const created = QuotaCharge.create({
      id: QuotaChargeId.reconstitute("charge-1"),
      userId: UserId.reconstitute(ACCESS_FIXTURE_USER_ID),
      meter: "AI_PLAN",
      idempotencyKey: null,
      requestHash: null,
      reason: "parse-todo",
      window: WINDOW,
      now: NOW,
    });

    // Then
    expect(created.toPrimitives()).toEqual({
      id: "charge-1",
      userId: ACCESS_FIXTURE_USER_ID,
      meter: "AI_PLAN",
      idempotencyKey: null,
      requestHash: null,
      amount: 1,
      status: "RESERVED",
      attempt: 1,
      reason: "parse-todo",
      refundReason: null,
      periodKey: "2026-M04",
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it("환불은 정확히 한 번만 바뀌고 두 번째 환불과 확정은 false다", () => {
    // Given
    const reserved = createQuotaChargeFixture();

    // When
    const first = reserved.refund({ attempt: 1, reason: "FAILED", now: NOW });
    const second = reserved.refund({ attempt: 1, reason: "NO_ACTION", now: NOW });
    const commit = reserved.commit({ attempt: 1, now: NOW });

    // Then
    expect([first, second, commit]).toEqual([true, false, false]);
    expect(reserved.toPrimitives()).toMatchObject({ status: "REFUNDED", refundReason: "FAILED" });
  });

  it("확정한 차감은 환불되지 않는다", () => {
    // Given
    const reserved = createQuotaChargeFixture();

    // When
    const committed = reserved.commit({ attempt: 1, now: NOW });
    const refunded = reserved.refund({ attempt: 1, reason: "FAILED", now: NOW });

    // Then
    expect([committed, refunded]).toEqual([true, false]);
    expect(reserved.status).toBe("COMMITTED");
  });

  it("이전 시도의 늦은 확정·환불은 새 시도를 바꾸지 않는다", () => {
    // Given
    const reserved = createQuotaChargeFixture({ status: "REFUNDED", refundReason: "FAILED" });
    reserved.reserveAgain({ reason: "voice-note-digest", window: WINDOW, now: NOW });

    // When
    const lateRefund = reserved.refund({ attempt: 1, reason: "FAILED", now: NOW });
    const lateCommit = reserved.commit({ attempt: 1, now: NOW });

    // Then
    expect([lateRefund, lateCommit]).toEqual([false, false]);
    expect(reserved.toPrimitives()).toMatchObject({
      status: "RESERVED",
      attempt: 2,
      refundReason: null,
    });
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
      const existing = createQuotaChargeFixture({ status });

      // When
      const decision = existing.resolveReplayAt(NOW.add({ milliseconds: ageMs }));

      // Then
      expect(decision).toBe(replay);
    },
  );

  it("다시 예약은 환불된 차감에서만, 이어받기는 멈춘 예약에서만 바뀐다", () => {
    // Given
    const fresh = createQuotaChargeFixture();
    const committed = createQuotaChargeFixture({ status: "COMMITTED" });
    const stale = createQuotaChargeFixture();

    // When
    const reservedAgain = fresh.reserveAgain({ reason: "x", window: WINDOW, now: NOW });
    const committedAgain = committed.reserveAgain({ reason: "x", window: WINDOW, now: NOW });
    const freshTakeOver = fresh.takeOver({ window: WINDOW, now: NOW });
    const staleTakeOver = stale.takeOver({ window: WINDOW, now: TAKEOVER_AT });

    // Then
    expect([reservedAgain, committedAgain, freshTakeOver, staleTakeOver]).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(stale.version).toEqual({ status: "RESERVED", attempt: 2 });
    expect(stale.toPrimitives().updatedAt.equals(TAKEOVER_AT)).toBe(true);
  });

  it("확정한 차감만 다시 열고 시도를 올린다", () => {
    // Given
    const committed = createQuotaChargeFixture({ status: "COMMITTED" });
    const reserved = createQuotaChargeFixture();

    // When
    const reopened = committed.reopen(NOW);
    const reservedReopened = reserved.reopen(NOW);

    // Then
    expect([reopened, reservedReopened]).toEqual([true, false]);
    expect(committed.version).toEqual({ status: "RESERVED", attempt: 2 });
  });

  it("끝내 응답하지 못한 예약은 이어받을 시간이 지난 뒤에만 돌려주고 사유를 남긴다", () => {
    // Given
    const reserved = createQuotaChargeFixture();

    // When
    const early = reserved.refundAbandoned(TAKEOVER_AT.subtract({ milliseconds: 1 }));
    const late = reserved.refundAbandoned(TAKEOVER_AT);
    const again = reserved.refundAbandoned(TAKEOVER_AT);

    // Then
    expect([early, late, again]).toEqual([false, true, false]);
    expect(reserved.toPrimitives()).toMatchObject({
      status: "REFUNDED",
      refundReason: "ABANDONED",
    });
  });

  it("확정한 차감은 오래돼도 돌려주지 않는다", () => {
    // Given
    const committed = createQuotaChargeFixture();
    committed.commit({ attempt: 1, now: NOW });

    // When
    const refunded = committed.refundAbandoned(NOW.add({ hours: 24 }));

    // Then
    expect(refunded).toBe(false);
    expect(committed.status).toBe("COMMITTED");
  });

  it("같은 작업·같은 지문이어야 같은 요청이다", () => {
    // Given
    const charge = createQuotaChargeFixture({ requestHash: "hash-a" });

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
