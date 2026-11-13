import { ErrorCode } from "@aido/api/errors";
import { PLAN_CATALOG } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import {
  ACCESS_FIXTURE_NOW,
  type AccessUserInput,
} from "#test/fixtures/access/access-user.fixture";
import { createQuotaLedgerFixture } from "#test/fixtures/access/quota-ledger.fixture";

const FREE_AI_LIMIT = PLAN_CATALOG.AI_PARSE.free;

function setup(input: AccessUserInput = {}) {
  const clock = new FixedClock(ACCESS_FIXTURE_NOW);
  const fixture = createQuotaLedgerFixture(input, undefined, { clock });
  const reserve = (idempotencyKey: string | null = null) =>
    fixture.ledger.reserve({
      userId: UserId.reconstitute(fixture.userId),
      feature: "AI_PARSE",
      idempotencyKey,
      reason: "parse-todo",
    });
  const used = async () =>
    (await fixture.ledger.read(UserId.reconstitute(fixture.userId), "AI_PARSE")).used;
  const chargeOf = (chargeId: string) =>
    fixture.quotaChargeRepository.all.find((charge) => charge.id === chargeId);
  return { ...fixture, clock, reserve, used, chargeOf };
}

describe("RefundQuotaReservationUseCase·CommitQuotaReservationUseCase — 확정과 환불", () => {
  it("예약은 즉시 사용량을 차감하고 같은 기간 환불은 정확히 한 번만 되돌린다", async () => {
    // Given
    const fixture = setup({ aiUsageCount: 2 });

    // When
    const reservation = await fixture.reserve();
    const reserved = await fixture.used();
    const first = await fixture.ledger.refund(reservation, "FAILED");
    const second = await fixture.ledger.refund(reservation, "FAILED");

    // Then
    expect(reserved).toBe(3);
    expect([first, second]).toEqual([true, false]);
    expect(await fixture.used()).toBe(2);
    expect(reservation).toEqual({
      chargeId: expect.any(String),
      userId: fixture.userId,
      feature: "AI_PARSE",
      attempt: 1,
      isAlreadyCommitted: false,
    });
    expect(Object.isFrozen(reservation)).toBe(true);
    expect(fixture.chargeOf(reservation.chargeId)).toMatchObject({
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
    const fixture = setup();
    const reservation = await fixture.reserve();

    // When
    const committed = await fixture.ledger.commit(reservation);
    const refunded = await fixture.ledger.refund(reservation, "FAILED");

    // Then
    expect([committed, refunded]).toEqual([true, false]);
    expect(await fixture.used()).toBe(1);
    expect(fixture.chargeOf(reservation.chargeId)?.status).toBe("COMMITTED");
  });

  it("지난 달 예약의 환불은 새 달 사용량을 줄이지 않고 원장만 환불로 남긴다", async () => {
    // Given
    const fixture = setup();
    const previous = await fixture.reserve();
    fixture.clock.advanceBy({
      milliseconds:
        Temporal.Instant.from("2026-04-30T15:00:00Z").epochMilliseconds -
        ACCESS_FIXTURE_NOW.epochMilliseconds,
    });
    await fixture.reserve();

    // When
    const refunded = await fixture.ledger.refund(previous, "FAILED");

    // Then
    expect(refunded).toBe(true);
    expect(
      await fixture.ledger.read(UserId.reconstitute(fixture.userId), "AI_PARSE"),
    ).toMatchObject({
      used: 1,
      limit: FREE_AI_LIMIT,
      resetsAt: "2026-05-31T15:00:00.000Z",
    });
    expect(fixture.chargeOf(previous.chargeId)?.status).toBe("REFUNDED");
  });

  it("사용자가 사라지면 읽기는 USER_0601이고 환불은 false로 안전하게 끝난다", async () => {
    // Given
    const fixture = setup();
    const reservation = await fixture.reserve();
    fixture.users.clear();

    // When
    const read = fixture.ledger.read(UserId.reconstitute(fixture.userId), "AI_PARSE");
    const refunded = await fixture.ledger.refund(reservation, "FAILED");

    // Then
    await expect(read).rejects.toMatchObject({ errorCode: ErrorCode.USER_0601 });
    expect(refunded).toBe(false);
  });

  it("환불·확정 저장 오류는 원래 요청 오류를 덮지 않고 원문 없이 기록한다", async () => {
    // Given
    const fixture = setup();
    const reservation = await fixture.reserve();
    vi.spyOn(fixture.quotaChargeRepository, "saveIfUnchanged").mockRejectedValue(
      new Error("private database details"),
    );

    // When
    const refunded = await fixture.ledger.refund(reservation, "FAILED");
    const committed = await fixture.ledger.commit(reservation);

    // Then
    expect([refunded, committed]).toEqual([false, false]);
    expect(await fixture.used()).toBe(1);
    expect(fixture.logger.messages).toContainEqual({
      event: "access.quota.refund-failed",
      chargeId: reservation.chargeId,
      meter: "AI_PLAN",
      errorType: "Error",
    });
    expect(fixture.logger.messages).toContainEqual({
      event: "access.quota.commit-failed",
      chargeId: reservation.chargeId,
      meter: "AI_PLAN",
      errorType: "Error",
    });
    expect(JSON.stringify(fixture.logger.messages)).not.toContain("private database details");
  });

  it("예약·확정·환불 로그는 chargeId·meter·reason만 남긴다", async () => {
    // Given
    const fixture = setup();

    // When
    const committed = await fixture.reserve();
    await fixture.ledger.commit(committed);
    const refunded = await fixture.reserve();
    await fixture.ledger.refund(refunded, "NO_ACTION");

    // Then
    expect(fixture.logger.messages).toEqual([
      {
        event: "access.quota.reserved",
        chargeId: committed.chargeId,
        meter: "AI_PLAN",
        reason: "parse-todo",
      },
      {
        event: "access.quota.committed",
        chargeId: committed.chargeId,
        meter: "AI_PLAN",
        reason: "parse-todo",
      },
      {
        event: "access.quota.reserved",
        chargeId: refunded.chargeId,
        meter: "AI_PLAN",
        reason: "parse-todo",
      },
      {
        event: "access.quota.refunded",
        chargeId: refunded.chargeId,
        meter: "AI_PLAN",
        reason: "NO_ACTION",
      },
    ]);
  });
});

describe("ReopenQuotaReservationUseCase — 결과를 잃은 확정 다시 열기", () => {
  it("확정한 예약을 같은 행에서 다시 열고 추가로 차감하지 않으며 다시 열린 예약은 환불할 수 있다", async () => {
    // Given
    const fixture = setup();
    const first = await fixture.reserve("key-1");
    await fixture.ledger.commit(first);
    const replay = await fixture.reserve("key-1");

    // When
    const reopened = await fixture.ledger.reopen(replay);
    const usedAfterReopen = await fixture.used();
    const refunded = await fixture.ledger.refund(reopened, "FAILED");

    // Then
    expect(reopened).toEqual({
      chargeId: first.chargeId,
      userId: fixture.userId,
      feature: "AI_PARSE",
      attempt: 2,
      isAlreadyCommitted: false,
    });
    expect(usedAfterReopen).toBe(1);
    expect(refunded).toBe(true);
    expect(await fixture.used()).toBe(0);
  });

  it("다른 재요청이 먼저 다시 열었으면 차감 없이 AI_1314다", async () => {
    // Given
    const fixture = setup();
    const first = await fixture.reserve("key-1");
    await fixture.ledger.commit(first);
    const replay = await fixture.reserve("key-1");
    await fixture.ledger.reopen(replay);

    // When
    const execution = fixture.ledger.reopen(replay);

    // Then
    await expect(execution).rejects.toMatchObject({
      errorCode: ErrorCode.AI_1314,
      details: { charged: false, featureQuota: { feature: "AI_PARSE", used: 1 } },
    });
  });
});
