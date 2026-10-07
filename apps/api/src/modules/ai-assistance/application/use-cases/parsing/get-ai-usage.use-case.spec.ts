import { AI_QUOTA_TIME, createAiQuotaFixture } from "#test/fixtures/ai-quota.fixture";

import { GetAiUsage } from "./get-ai-usage.use-case.js";

describe("GetAiUsage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AI_QUOTA_TIME);
  });
  afterEach(() => vi.useRealTimers());
  it("현재 기간의 사용량과 REST 응답 리셋 시각을 반환한다", async () => {
    // Given
    const fixture = createAiQuotaFixture({ count: 3 });
    const useCase = new GetAiUsage(fixture);
    // When
    const usage = await useCase.execute({ userId: fixture.userId });
    // Then
    expect(usage).toEqual({ used: 3, limit: 5, resetsAt: "2026-04-30T15:00:00.000Z" });
  });
  it("새로운 기간은 저장된 과거 사용량을 변경하지 않고 0으로 표시한다", async () => {
    // Given
    const fixture = createAiQuotaFixture({ count: 5, resetAt: new Date("2026-03-12T12:00:00Z") });
    // When
    const usage = await new GetAiUsage(fixture).execute({ userId: fixture.userId });
    // Then
    expect(usage.used).toBe(0);
    expect(fixture.repository.users.get(fixture.userId)?.count).toBe(5);
  });
  it("사용자가 없으면 USER_0601을 반환한다", async () => {
    // Given
    const fixture = createAiQuotaFixture();
    fixture.repository.users.clear();
    // When
    const execution = new GetAiUsage(fixture).execute({ userId: fixture.userId });
    // Then
    await expect(execution).rejects.toMatchObject({ errorCode: "USER_0601" });
  });
});
