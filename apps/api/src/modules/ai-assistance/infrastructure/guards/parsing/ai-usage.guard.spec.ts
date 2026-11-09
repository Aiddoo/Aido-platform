import type { CurrentUserPayload } from "@aido/api";
import { PLAN_CATALOG } from "@aido/api/vocabulary";

import { createAiParsingFixture } from "#test/fixtures/ai-parsing.fixture";
import { QUOTA_LEDGER_TIME } from "#test/fixtures/quota-ledger.fixture";
import { createMockExecutionContext } from "#test/mocks/index";

import { GetAiUsage } from "../../../application/use-cases/parsing/get-ai-usage.use-case.js";
import { AiUsageGuard } from "./ai-usage.guard.js";

const FREE_AI_LIMIT = PLAN_CATALOG.AI_PARSE.free;
const PREMIUM_FAIR_USE = PLAN_CATALOG.AI_PARSE.fairUse.premium;

function guardFor(fixture: ReturnType<typeof createAiParsingFixture>) {
  const user: CurrentUserPayload = {
    userId: fixture.userId,
    email: "quota@example.com",
    sessionId: "session",
    role: "USER",
  };
  return {
    guard: new AiUsageGuard(new GetAiUsage(fixture)),
    context: createMockExecutionContext({ user }).context,
  };
}

describe("AiUsageGuard", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(QUOTA_LEDGER_TIME);
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    { aiUsageCount: FREE_AI_LIMIT - 1, subscriptionStatus: "FREE" },
    { aiUsageCount: PREMIUM_FAIR_USE - 1, subscriptionStatus: "ACTIVE" },
  ])(
    "$subscriptionStatus 구독의 사용량 $aiUsageCount 는 요청을 허용한다",
    async ({ aiUsageCount, subscriptionStatus }) => {
      // Given
      const { guard, context } = guardFor(
        createAiParsingFixture({ aiUsageCount, subscriptionStatus }),
      );

      // When
      const allowed = await guard.canActivate(context);

      // Then
      expect(allowed).toBe(true);
    },
  );

  it.each([
    { aiUsageCount: FREE_AI_LIMIT, subscriptionStatus: "FREE", limit: FREE_AI_LIMIT },
    { aiUsageCount: FREE_AI_LIMIT + 1, subscriptionStatus: "FREE", limit: FREE_AI_LIMIT },
    { aiUsageCount: PREMIUM_FAIR_USE, subscriptionStatus: "ACTIVE", limit: PREMIUM_FAIR_USE },
  ])(
    "$subscriptionStatus 사용량 $aiUsageCount 는 차감 없이 AI_1303과 현재 한도를 반환한다",
    async ({ aiUsageCount, subscriptionStatus, limit }) => {
      // Given
      const { guard, context } = guardFor(
        createAiParsingFixture({ aiUsageCount, subscriptionStatus }),
      );

      // When
      const execution = guard.canActivate(context);

      // Then
      await expect(execution).rejects.toMatchObject({
        errorCode: "AI_1303",
        details: {
          charged: false,
          featureQuota: { feature: "AI_PARSE", used: aiUsageCount, limit, remaining: 0 },
        },
      });
    },
  );

  it("인증 정보가 없으면 AUTH_0107을 반환한다", async () => {
    // Given
    const fixture = createAiParsingFixture();
    const guard = new AiUsageGuard(new GetAiUsage(fixture));
    const { context } = createMockExecutionContext();

    // When
    const execution = guard.canActivate(context);

    // Then
    await expect(execution).rejects.toMatchObject({ errorCode: "AUTH_0107" });
  });
});
