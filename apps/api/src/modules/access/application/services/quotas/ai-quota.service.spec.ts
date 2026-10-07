import { AI_QUOTA_TIME, createAiQuotaFixture } from "#test/fixtures/ai-quota.fixture";

describe("AiQuotaService", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AI_QUOTA_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it("예약은 즉시 사용량을 유지하고 같은 기간 실패 보상은 기존 사용량만 복원한다", async () => {
    // Given
    const fixture = createAiQuotaFixture({ count: 2 });
    // When
    const reservation = await fixture.quota.reserve(fixture.userId);
    const reserved = await fixture.quota.read(fixture.userId);
    await fixture.quota.release(reservation);
    // Then
    expect(reserved.used).toBe(3);
    expect((await fixture.quota.read(fixture.userId)).used).toBe(2);
    expect(reservation).toEqual({ userId: fixture.userId, periodId: "2026-M04" });
    expect(Object.isFrozen(reservation)).toBe(true);
  });
  it("정확한 한도 도달 요청은 저장된 사용량을 변경하지 않는다", async () => {
    // Given
    const fixture = createAiQuotaFixture({ count: 5 });
    // When
    const execution = fixture.quota.reserve(fixture.userId);
    // Then
    await expect(execution).rejects.toMatchObject({
      errorCode: "AI_1303",
      details: { used: 5, limit: 5 },
    });
    expect(fixture.repository.users.get(fixture.userId)?.count).toBe(5);
  });
  it.each([
    { role: "ADMIN", subscriptionStatus: "FREE" },
    { role: "USER", subscriptionStatus: "ACTIVE" },
  ])("$role/$subscriptionStatus 사용자는 무료 한도를 넘어 예약할 수 있다", async (state) => {
    // Given
    const fixture = createAiQuotaFixture({ ...state, count: 100 });
    // When
    await fixture.quota.reserve(fixture.userId);
    // Then
    expect(await fixture.quota.read(fixture.userId)).toMatchObject({ used: 101, limit: null });
  });
  it("이전 기간의 실패 보상은 새로운 기간에 성공한 요청을 차감하지 않는다", async () => {
    // Given
    const fixture = createAiQuotaFixture();
    const previous = await fixture.quota.reserve(fixture.userId);
    vi.setSystemTime(new Date("2026-04-30T15:00:00Z"));
    // When
    await fixture.quota.reserve(fixture.userId);
    await fixture.quota.release(previous);
    // Then
    expect(await fixture.quota.read(fixture.userId)).toEqual({
      used: 1,
      limit: 5,
      resetsAt: "2026-05-31T15:00:00.000Z",
    });
  });
  it("기간 변경 후 첫 예약은 과거 사용량을 하나로 갱신한다", async () => {
    // Given
    const fixture = createAiQuotaFixture({ count: 5, resetAt: new Date("2026-03-12T12:00:00Z") });
    // When
    await fixture.quota.reserve(fixture.userId);
    // Then
    expect(fixture.repository.users.get(fixture.userId)).toMatchObject({
      count: 1,
      resetAt: AI_QUOTA_TIME,
    });
  });
  it("예약은 캐시와 무관하게 현재 구독 상태의 한도를 사용한다", async () => {
    // Given
    const fixture = createAiQuotaFixture({ subscriptionStatus: "ACTIVE", count: 5 });
    await fixture.quota.read(fixture.userId);
    const state = await fixture.repository.findQuotaState(fixture.userId);
    if (state === null) throw new Error("fixture user missing");
    fixture.repository.users.set(fixture.userId, { ...state, subscriptionStatus: "FREE" });
    // When
    const execution = fixture.quota.reserve(fixture.userId);
    // Then
    await expect(execution).rejects.toMatchObject({ errorCode: "AI_1303" });
    expect((await fixture.quota.read(fixture.userId)).limit).toBe(5);
  });
  it("사용자가 사라지면 조회와 예약은 USER_0601이고 실패 보상은 안전하게 종료한다", async () => {
    // Given
    const fixture = createAiQuotaFixture();
    const reservation = await fixture.quota.reserve(fixture.userId);
    fixture.repository.users.clear();
    // When
    const read = fixture.quota.read(fixture.userId);
    const reserve = fixture.quota.reserve(fixture.userId);
    // Then
    await expect(read).rejects.toMatchObject({ errorCode: "USER_0601" });
    await expect(reserve).rejects.toMatchObject({ errorCode: "USER_0601" });
    await expect(fixture.quota.release(reservation)).resolves.toBeUndefined();
  });
  it("보상 저장 오류는 원래 요청 오류를 덮지 않고 원문 없이 기록한다", async () => {
    // Given
    const fixture = createAiQuotaFixture();
    const reservation = await fixture.quota.reserve(fixture.userId);
    vi.spyOn(fixture.repository, "releaseUsage").mockRejectedValueOnce(
      new Error("private database details"),
    );
    // When
    await fixture.quota.release(reservation);
    // Then
    expect((await fixture.quota.read(fixture.userId)).used).toBe(1);
    expect(fixture.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ userId: fixture.userId, errorType: "Error" }),
    );
    expect(JSON.stringify(fixture.logger.error.mock.calls)).not.toContain(
      "private database details",
    );
  });
});
