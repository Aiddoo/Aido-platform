import type { CurrentUserPayload } from "@aido/api";

import { AI_QUOTA_TIME, createAiQuotaFixture } from "#test/fixtures/ai-quota.fixture";
import { createMockExecutionContext } from "#test/mocks/index";

import { GetAiUsage } from "../../../application/use-cases/parsing/get-ai-usage.use-case.js";
import { AiUsageGuard } from "./ai-usage.guard.js";

describe("AiUsageGuard", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AI_QUOTA_TIME);
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    { count: 2, status: "FREE" },
    { count: 1000, status: "ACTIVE" },
  ])("$status 구독의 사용량 $count 는 요청을 허용한다", async ({ count, status }) => {
    // Given
    const fixture = createAiQuotaFixture({ count, subscriptionStatus: status });
    const guard = new AiUsageGuard(new GetAiUsage(fixture));
    const user: CurrentUserPayload = {
      userId: fixture.userId,
      email: "quota@example.com",
      sessionId: "session",
      role: "USER",
    };
    const { context } = createMockExecutionContext({ user });
    // When
    const allowed = await guard.canActivate(context);
    // Then
    expect(allowed).toBe(true);
  });

  it.each([5, 6])("무료 사용량 %i 는 한도 도달 오류와 실제 사용량을 반환한다", async (count) => {
    // Given
    const fixture = createAiQuotaFixture({ count });
    const guard = new AiUsageGuard(new GetAiUsage(fixture));
    const user: CurrentUserPayload = {
      userId: fixture.userId,
      email: "quota@example.com",
      sessionId: "session",
      role: "USER",
    };
    const { context } = createMockExecutionContext({ user });
    // When
    const execution = guard.canActivate(context);
    // Then
    await expect(execution).rejects.toMatchObject({
      errorCode: "AI_1303",
      details: { used: count, limit: 5 },
    });
  });

  it("인증 정보가 없으면 AUTH_0107을 반환한다", async () => {
    // Given
    const fixture = createAiQuotaFixture();
    const guard = new AiUsageGuard(new GetAiUsage(fixture));
    const { context } = createMockExecutionContext();
    // When
    const execution = guard.canActivate(context);
    // Then
    await expect(execution).rejects.toMatchObject({ errorCode: "AUTH_0107" });
  });
});
