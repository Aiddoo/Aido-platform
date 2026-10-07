import { AiQuotaUsage } from "./ai-quota-usage.aggregate.js";
const AT = new Date("2026-04-12T12:00:00Z");

describe("AiQuotaUsage", () => {
  it.each([
    { count: 4, limit: 5, reserved: true },
    { count: 5, limit: 5, reserved: false },
    { count: 6, limit: 5, reserved: false },
    { count: 1000, limit: null, reserved: true },
  ])("사용량 $count, 한도 $limit 예약 결정은 $reserved 이다", ({ count, limit, reserved }) => {
    // Given
    const usage = AiQuotaUsage.reconstitute({ userId: "user", count, resetAt: AT });
    // When
    const decision = usage.reserve({ at: AT, limit });
    // Then
    expect(decision.status).toBe(reserved ? "reserved" : "exceeded");
    expect(usage.snapshot.count).toBe(count + (reserved ? 1 : 0));
  });
  it.each([
    { resetAt: null },
    { resetAt: new Date("2026-03-12T12:00:00Z") },
    { resetAt: new Date("2026-05-12T12:00:00Z") },
  ])("현재 기간과 다른 resetAt=$resetAt 은 새 기간 첫 사용으로 시작한다", ({ resetAt }) => {
    // Given
    const usage = AiQuotaUsage.reconstitute({ userId: "user", count: 9, resetAt });
    // When
    const decision = usage.reserve({ at: AT, limit: 5 });
    // Then
    expect(decision).toEqual({
      status: "reserved",
      periodId: "2026-M04",
      usage: { count: 1, resetAt: AT },
    });
  });
  it("같은 기간의 실패 보상은 한 회를 감소시키고 음수가 되지 않는다", () => {
    // Given
    const usage = AiQuotaUsage.reconstitute({ userId: "user", count: 1, resetAt: AT });
    // When
    const released = usage.release("2026-M04");
    const exhausted = usage.release("2026-M04");
    // Then
    expect(released).toEqual({ count: 0, expectedResetAt: AT });
    expect(exhausted).toBeNull();
    expect(usage.snapshot.count).toBe(0);
  });
  it("이전 기간 예약의 실패 보상은 새 기간 사용량을 감소시키지 않는다", () => {
    // Given
    const usage = AiQuotaUsage.reconstitute({ userId: "user", count: 2, resetAt: AT });
    // When
    const result = usage.release("2026-M03");
    // Then
    expect(result).toBeNull();
    expect(usage.snapshot.count).toBe(2);
  });
  it("복원 입력과 반환 snapshot의 Date 변경은 내부 상태에 영향을 주지 않는다", () => {
    // Given
    const resetAt = new Date(AT);
    const usage = AiQuotaUsage.reconstitute({ userId: "user", count: 2, resetAt });
    // When
    resetAt.setUTCFullYear(2000);
    usage.snapshot.resetAt?.setUTCFullYear(2001);
    // Then
    expect(usage.snapshot.resetAt).toEqual(AT);
    expect(usage.usedAt(AT)).toBe(2);
  });
  it("예약 및 보상 write plan의 Date 변경은 Aggregate 기간을 변경하지 않는다", () => {
    // Given
    const usage = AiQuotaUsage.reconstitute({ userId: "user", count: 0, resetAt: null });
    const at = new Date(AT);
    // When
    const reservation = usage.reserve({ at, limit: 5 });
    if (reservation.status !== "reserved") throw new Error("expected reserved fixture");
    reservation.usage.resetAt.setUTCFullYear(2000);
    at.setUTCFullYear(2001);
    const release = usage.release("2026-M04");
    release?.expectedResetAt.setUTCFullYear(2002);
    // Then
    expect(usage.snapshot).toEqual({ count: 0, resetAt: AT });
  });
});
