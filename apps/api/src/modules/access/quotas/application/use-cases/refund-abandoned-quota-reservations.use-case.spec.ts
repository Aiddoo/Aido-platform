import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import {
  ACCESS_FIXTURE_NOW,
  type AccessUserInput,
} from "#test/fixtures/access/access-user.fixture";
import { createQuotaLedgerFixture } from "#test/fixtures/access/quota-ledger.fixture";

import {
  QUOTA_ABANDONED_REFUND_BATCH_SIZE,
  QUOTA_REQUEST_HASH_RETENTION_MS,
  QUOTA_RESERVATION_TAKEOVER_AFTER_MS,
  QUOTA_STALE_RESERVATION_ALERT_AFTER_MS,
} from "../../domain/quotas.constants.js";

function setup(input: AccessUserInput = {}) {
  const clock = new FixedClock(ACCESS_FIXTURE_NOW);
  const fixture = createQuotaLedgerFixture(input, undefined, { clock });
  const reserve = (
    options: { readonly idempotencyKey?: string; readonly requestHash?: string } = {},
  ) =>
    fixture.ledger.reserve({
      userId: UserId.reconstitute(fixture.userId),
      feature: "AI_PARSE",
      idempotencyKey: options.idempotencyKey ?? null,
      requestHash: options.requestHash,
      reason: "parse-todo",
    });
  const used = async () =>
    (await fixture.ledger.read(UserId.reconstitute(fixture.userId), "AI_PARSE")).used;
  const chargeOf = (chargeId: string) =>
    fixture.quotaChargeRepository.all.find((charge) => charge.id === chargeId);
  return { ...fixture, clock, reserve, used, chargeOf };
}

describe("RefundAbandonedQuotaReservationsUseCase — 멈춘 예약 정리", () => {
  it("이어받을 시간이 지난 예약만 돌려주고 완료 수를 남긴다", async () => {
    // Given
    const fixture = setup();
    const stale = await fixture.reserve();
    fixture.clock.advanceBy({ milliseconds: QUOTA_RESERVATION_TAKEOVER_AFTER_MS - 1 });
    const fresh = await fixture.reserve();
    fixture.clock.advanceBy({ milliseconds: 1 });

    // When
    await fixture.refundAbandonedReservations.execute();

    // Then
    expect(await fixture.used()).toBe(1);
    expect(fixture.chargeOf(stale.chargeId)).toMatchObject({
      status: "REFUNDED",
      refundReason: "ABANDONED",
    });
    expect(fixture.chargeOf(fresh.chargeId)).toMatchObject({ status: "RESERVED" });
    expect(fixture.logger.messages).toContainEqual({
      event: "access.quota.abandoned-refund.completed",
      candidateCount: 1,
      refundedCount: 1,
      failedCount: 0,
      staleCount: 0,
      clearedHashCount: 0,
    });
    expect(fixture.alert.alerts).toEqual([]);
  });

  it("30분 넘게 돌려주지 못한 예약이 있으면 사람에게 알린다", async () => {
    // Given
    const fixture = setup();
    await fixture.reserve();
    fixture.clock.advanceBy({ milliseconds: QUOTA_STALE_RESERVATION_ALERT_AFTER_MS });
    // 사용자 행을 잠글 수 없으면 예약을 돌려주지 못하고 남는다
    fixture.users.clear();

    // When
    await fixture.refundAbandonedReservations.execute();

    // Then
    expect(fixture.alert.alerts).toEqual([
      expect.objectContaining({
        key: "access.quota.stale-reservation",
        severity: "error",
        details: { failedCount: 0, staleCount: 1 },
      }),
    ]);
  });

  it("다시 돌아도 한 번만 돌려주고 늦게 온 확정·환불은 아무것도 바꾸지 않는다", async () => {
    // Given
    const fixture = setup({ aiUsageCount: 2 });
    const reservation = await fixture.reserve();
    fixture.clock.advanceBy({ milliseconds: QUOTA_RESERVATION_TAKEOVER_AFTER_MS });

    // When
    await fixture.refundAbandonedReservations.execute();
    await fixture.refundAbandonedReservations.execute();
    const lateCommit = await fixture.ledger.commit(reservation);
    const lateRefund = await fixture.ledger.refund(reservation, "FAILED");

    // Then
    expect([lateCommit, lateRefund]).toEqual([false, false]);
    expect(await fixture.used()).toBe(2);
  });

  it("한 건의 저장 오류는 기록만 하고 다음 건을 계속 돌려준다", async () => {
    // Given
    const fixture = setup();
    const failing = await fixture.reserve();
    const next = await fixture.reserve();
    fixture.clock.advanceBy({ milliseconds: QUOTA_RESERVATION_TAKEOVER_AFTER_MS });
    vi.spyOn(fixture.quotaChargeRepository, "saveIfUnchanged").mockRejectedValueOnce(
      new TypeError("db down"),
    );

    // When
    await fixture.refundAbandonedReservations.execute();

    // Then
    expect(fixture.chargeOf(next.chargeId)).toMatchObject({ status: "REFUNDED" });
    expect(fixture.logger.messages).toContainEqual({
      event: "access.quota.refund-failed",
      chargeId: failing.chargeId,
      meter: "AI_PLAN",
      errorType: "TypeError",
    });
    expect(fixture.logger.messages).toContainEqual(
      expect.objectContaining({ refundedCount: 1, failedCount: 1 }),
    );
    expect(fixture.alert.alerts).toEqual([
      expect.objectContaining({ details: { failedCount: 1, staleCount: 0 } }),
    ]);
  });

  it("한 번에 정해진 수만 돌려주고 남은 예약은 다음 주기에 돌려준다", async () => {
    // Given
    const fixture = setup({ subscriptionStatus: "ACTIVE" });
    for (let index = 0; index <= QUOTA_ABANDONED_REFUND_BATCH_SIZE; index += 1) {
      await fixture.reserve();
    }
    fixture.clock.advanceBy({ milliseconds: QUOTA_RESERVATION_TAKEOVER_AFTER_MS });

    // When
    await fixture.refundAbandonedReservations.execute();
    const firstRun = await fixture.used();
    await fixture.refundAbandonedReservations.execute();

    // Then
    expect(firstRun).toBe(1);
    expect(await fixture.used()).toBe(0);
  });

  it("7일 지난 차감의 요청 해시를 지우고 최근 차감은 둔다", async () => {
    // Given
    const fixture = setup();
    const old = await fixture.reserve({ idempotencyKey: "old", requestHash: "old-hash" });
    await fixture.ledger.commit(old);
    fixture.clock.advanceBy({ milliseconds: QUOTA_REQUEST_HASH_RETENTION_MS });
    const recent = await fixture.reserve({ idempotencyKey: "recent", requestHash: "recent-hash" });
    await fixture.ledger.commit(recent);

    // When
    await fixture.refundAbandonedReservations.execute();

    // Then
    expect(fixture.chargeOf(old.chargeId)?.requestHash).toBeNull();
    expect(fixture.chargeOf(recent.chargeId)?.requestHash).toBe("recent-hash");
  });
});
