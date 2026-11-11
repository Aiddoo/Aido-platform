import { PLAN_CATALOG } from "@aido/api/vocabulary";

import { QUOTA_LEDGER_TIME } from "#test/fixtures/access/quota-ledger.fixture";
import { createAiParsingFixture } from "#test/fixtures/ai-parsing.fixture";

import { GetAiUsageUseCase } from "./get-ai-usage.use-case.js";

const FREE_AI_LIMIT = PLAN_CATALOG.AI_PARSE.free;

describe("GetAiUsageUseCase", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(QUOTA_LEDGER_TIME);
  });
  afterEach(() => vi.useRealTimers());
  it("현재 기간의 AI_PARSE 사용량과 KST 다음 달 리셋 시각을 반환한다", async () => {
    // Given
    const fixture = createAiParsingFixture({ aiUsageCount: 3 });
    const useCase = new GetAiUsageUseCase(fixture);
    // When
    const usage = await useCase.execute({ userId: fixture.userId });
    // Then
    expect(usage).toMatchObject({
      feature: "AI_PARSE",
      used: 3,
      limit: FREE_AI_LIMIT,
      remaining: FREE_AI_LIMIT - 3,
      period: "month",
      resetsAt: "2026-04-30T15:00:00.000Z",
      isFairUse: false,
    });
  });
  it("새로운 기간은 저장된 과거 사용량을 변경하지 않고 0으로 표시한다", async () => {
    // Given
    const fixture = createAiParsingFixture({
      aiUsageCount: 5,
      aiUsageResetAt: new Date("2026-03-12T12:00:00Z"),
    });
    // When
    const usage = await new GetAiUsageUseCase(fixture).execute({ userId: fixture.userId });
    // Then
    expect(usage.used).toBe(0);
    expect(fixture.users.get(fixture.userId)?.aiUsageCount).toBe(5);
  });
  it("사용자가 없으면 USER_0601을 반환한다", async () => {
    // Given
    const fixture = createAiParsingFixture();
    fixture.users.clear();
    // When
    const execution = new GetAiUsageUseCase(fixture).execute({ userId: fixture.userId });
    // Then
    await expect(execution).rejects.toMatchObject({ errorCode: "USER_0601" });
  });
});
