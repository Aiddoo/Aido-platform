import { quotaErrorDetailsSchema } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { PLAN_CATALOG } from "@aido/api/vocabulary";
import { Controller, HttpCode, HttpStatus, Module, Post } from "@nestjs/common";
import { eq } from "drizzle-orm";
import request from "supertest";

import { AccessQuotasModule, RequireQuota } from "#api/modules/access/quotas/access-quotas.public";
import { quotaUsage, user as userTable } from "#api/platform/database/schema/index";
import { instantFromDate } from "#api/shared/domain/time/instant";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const AT = new Date("2026-04-12T12:00:00.000Z");
const MONTH_RESET = "2026-04-30T15:00:00.000Z";

// 공개 데코레이터를 소비 Context의 라우트처럼 붙여 본다
@Controller("test-require-quota")
class RequireQuotaProbeController {
  @Post("ai-plan")
  @HttpCode(HttpStatus.OK)
  @RequireQuota("AI_PLAN")
  aiPlan() {
    return { reached: true };
  }

  @Post("voice-note")
  @HttpCode(HttpStatus.OK)
  @RequireQuota("VOICE_NOTE")
  voiceNote() {
    return { reached: true };
  }
}

@Module({ imports: [AccessQuotasModule], controllers: [RequireQuotaProbeController] })
class RequireQuotaProbeModule {}

describe("@RequireQuota 남은 횟수 선검사 (실제 PostgreSQL)", () => {
  let context: E2eTestContext;
  let user: { userId: string; accessToken: string };

  beforeAll(async () => {
    context = await createE2eApp({ imports: [RequireQuotaProbeModule] });
  });

  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT);
    user = await context.helpers.createVerifiedUser("require-quota@example.com", "Test1234!");
  });

  afterEach(() => vi.useRealTimers());

  afterAll(async () => {
    await destroyE2eApp(context);
  });

  async function updateUser(values: Partial<typeof userTable.$inferInsert>) {
    await context.testDatabase
      .getClient()
      .update(userTable)
      .set(values)
      .where(eq(userTable.id, user.userId));
  }

  function call(path: string) {
    return request(context.app.getHttpServer())
      .post(`/v1/test-require-quota/${path}`)
      .set("Authorization", `Bearer ${user.accessToken}`);
  }

  async function storedAiUsageCount() {
    const [row] = await context.testDatabase
      .getClient()
      .select({ count: userTable.aiUsageCount })
      .from(userTable)
      .where(eq(userTable.id, user.userId));
    return row?.count;
  }

  it("남은 AI 횟수가 0이면 출시 앱과 같은 AI_1303과 차감 없음·현재 한도를 주고 핸들러에 닿지 않는다", async () => {
    // Given
    await updateUser({
      aiUsageCount: PLAN_CATALOG.AI_PARSE.free,
      aiUsageResetAt: instantFromDate(AT),
    });

    // When
    const response = await call("ai-plan");

    // Then
    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe(ErrorCode.AI_1303);
    expect(quotaErrorDetailsSchema.parse(response.body.error.details)).toEqual({
      charged: false,
      featureQuota: {
        feature: "AI_PARSE",
        allowed: true,
        limit: PLAN_CATALOG.AI_PARSE.free,
        used: PLAN_CATALOG.AI_PARSE.free,
        remaining: 0,
        period: "month",
        resetsAt: MONTH_RESET,
        isFairUse: false,
        perUse: null,
      },
    });
    expect(await storedAiUsageCount()).toBe(PLAN_CATALOG.AI_PARSE.free);
  });

  it("남은 횟수가 있으면 통과시키고 선검사는 차감하지 않는다", async () => {
    // Given
    await updateUser({
      aiUsageCount: PLAN_CATALOG.AI_PARSE.free - 1,
      aiUsageResetAt: instantFromDate(AT),
    });

    // When
    const response = await call("ai-plan");

    // Then
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ reached: true });
    expect(await storedAiUsageCount()).toBe(PLAN_CATALOG.AI_PARSE.free - 1);
  });

  it("지난 달 사용량은 새 달 남은 횟수를 막지 않는다", async () => {
    // Given
    await updateUser({
      aiUsageCount: PLAN_CATALOG.AI_PARSE.free,
      aiUsageResetAt: Temporal.Instant.from("2026-03-31T14:59:59.000Z"),
    });

    // When
    const response = await call("ai-plan");

    // Then
    expect(response.status).toBe(200);
  });

  it("녹음 정리 계량기는 따로 세고 다 쓰면 AI_1313으로 막는다", async () => {
    // Given
    await context.testDatabase
      .getClient()
      .insert(quotaUsage)
      .values({
        userId: user.userId,
        meter: "VOICE_NOTE",
        periodKey: "2026-M04",
        used: PLAN_CATALOG.VOICE_NOTE.free,
        updatedAt: instantFromDate(AT),
      });

    // When
    const voice = await call("voice-note");
    const ai = await call("ai-plan");

    // Then
    expect(voice.status).toBe(429);
    expect(voice.body.error.code).toBe(ErrorCode.AI_1313);
    expect(quotaErrorDetailsSchema.parse(voice.body.error.details)).toMatchObject({
      charged: false,
      featureQuota: { feature: "VOICE_NOTE", used: PLAN_CATALOG.VOICE_NOTE.free, remaining: 0 },
    });
    expect(ai.status).toBe(200);
  });

  it.each([
    { usedBefore: PLAN_CATALOG.AI_PARSE.fairUse.premium - 1, status: 200 },
    { usedBefore: PLAN_CATALOG.AI_PARSE.fairUse.premium, status: 429 },
  ])(
    "ADMIN은 프리미엄 공정 사용 상한으로 선검사한다($usedBefore회 사용 → $status)",
    async ({ usedBefore, status }) => {
      // Given
      await updateUser({
        role: "ADMIN",
        aiUsageCount: usedBefore,
        aiUsageResetAt: instantFromDate(AT),
      });

      // When
      const response = await call("ai-plan");

      // Then
      expect(response.status).toBe(status);
      expect(await storedAiUsageCount()).toBe(usedBefore);
    },
  );
});
