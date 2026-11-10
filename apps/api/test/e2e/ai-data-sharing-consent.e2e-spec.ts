/**
 * AI 데이터 처리 동의 E2E 테스트
 *
 * 동의 저장·철회 API와, 1.13.0 이상 앱만 동의 없이 AI를 쓸 수 없게 하는 X-App-Version 경계를
 * 실제 앱과 PostgreSQL로 확인한다. 공급자는 FakeAiGenerator로 막는다.
 */

import { AI_DATA_SHARING_CONSENT, PLAN_CATALOG } from "@aido/api/vocabulary";
import { eq } from "drizzle-orm";
import request from "supertest";

import { AiGeneratorPort } from "#api/modules/ai-assistance/generation/ai-assistance-generation.public";
import { user as userTable } from "#api/platform/database/schema/index";

import { FakeAiGenerator } from "../mocks/fake-ai.generator.js";
import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
  type VerifiedUser,
} from "./helpers/index.js";

describe("AI 데이터 처리 동의 E2E", () => {
  let ctx: E2eTestContext;
  let fakeAiGenerator: FakeAiGenerator;
  let user: VerifiedUser;

  beforeAll(async () => {
    fakeAiGenerator = new FakeAiGenerator();
    ctx = await createE2eApp({
      customizeBuilder: (builder) =>
        builder.overrideProvider(AiGeneratorPort).useValue(fakeAiGenerator),
      additionalResetters: [() => fakeAiGenerator.clear()],
    });
  }, 60000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.reset();
    user = await ctx.helpers.createVerifiedUser("ai-consent@example.com", "Test1234!");
    fakeAiGenerator.setResponse({
      title: "팀 미팅",
      date: { kind: "OFFSET_DAYS", amount: 1 },
      time: { hour: 3, minute: 0, meridiem: "PM" },
    });
  });

  function parseTodo(appVersion?: string) {
    const call = request(ctx.app.getHttpServer())
      .post("/v1/ai/parse-todo")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .set("X-Timezone", "Asia/Seoul");
    return (appVersion == null ? call : call.set("X-App-Version", appVersion)).send({
      text: "내일 오후 3시에 팀 미팅",
    });
  }

  function answerConsent(agreed: boolean, version: string = AI_DATA_SHARING_CONSENT.VERSION) {
    return request(ctx.app.getHttpServer())
      .patch("/v1/auth/consent/ai-data-sharing")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ agreed, version });
  }

  it("1.13.0 앱은 동의하기 전 AI_1311을 받고 사용량도 차감하지 않으며 공급자를 부르지 않는다", async () => {
    // When
    const response = await parseTodo("1.13.0");

    // Then
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("AI_1311");
    expect(fakeAiGenerator.getCallCount()).toBe(0);
    const usage = await request(ctx.app.getHttpServer())
      .get("/v1/ai/usage")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);
    expect(usage.body.data.data.used).toBe(0);
  });

  it("한도를 다 쓴 1.13.0 앱도 동의 전이면 한도 오류보다 동의 오류를 먼저 받는다", async () => {
    // Given
    await ctx.testDatabase
      .getClient()
      .update(userTable)
      .set({ aiUsageCount: PLAN_CATALOG.AI_PARSE.free, aiUsageResetAt: Temporal.Now.instant() })
      .where(eq(userTable.id, user.userId));

    // When
    const response = await parseTodo("1.13.0");

    // Then
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("AI_1311");
    expect(fakeAiGenerator.getCallCount()).toBe(0);
  });

  it("동의하면 1.13.0 앱의 AI 요청을 처리하고 동의 조회에 상태가 보인다", async () => {
    // Given
    const answered = await answerConsent(true).expect(200);

    // When
    const response = await parseTodo("1.13.0");

    // Then
    expect(answered.body.data).toMatchObject({
      aiDataSharingDecision: "AGREED",
      aiDataSharingConsentVersion: AI_DATA_SHARING_CONSENT.VERSION,
    });
    expect(response.status).toBe(200);
    const consent = await request(ctx.app.getHttpServer())
      .get("/v1/auth/consent")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);
    expect(consent.body.data.aiDataSharingDecision).toBe("AGREED");
  });

  it("동의 화면이 없는 1.12.1 앱과 버전 헤더가 없는 요청은 답하지 않은 사용자도 그대로 처리한다", async () => {
    // When
    const legacy = await parseTodo("1.12.1");
    const withoutHeader = await parseTodo();

    // Then
    expect(legacy.status).toBe(200);
    expect(withoutHeader.status).toBe(200);
  });

  it("철회하면 구 앱에서도 AI를 쓰지 않는다", async () => {
    // Given
    await answerConsent(true).expect(200);
    const withdrawn = await answerConsent(false).expect(200);

    // When
    const legacy = await parseTodo("1.12.1");

    // Then
    expect(withdrawn.body.data).toMatchObject({
      aiDataSharingDecision: "DECLINED",
      aiDataSharingAgreedAt: null,
    });
    expect(legacy.status).toBe(403);
    expect(legacy.body.error.code).toBe("AI_1311");
  });

  it("이미 만든 리포트·제안을 보는 요청은 새 데이터를 보내지 않으므로 동의를 묻지 않는다", async () => {
    // When - 1.13.0 앱, 아직 답하지 않은 사용자
    const responses = await Promise.all(
      ["/v1/ai/reports?type=WEEKLY", "/v1/ai/suggestions"].map((path) =>
        request(ctx.app.getHttpServer())
          .get(path)
          .set("Authorization", `Bearer ${user.accessToken}`)
          .set("X-App-Version", "1.13.0"),
      ),
    );

    // Then - 프리미엄 여부 등 다른 이유로 거절될 수는 있어도 동의 때문에 막지 않는다
    for (const response of responses) {
      expect(response.body.error?.code).not.toBe("AI_1311");
    }
  });

  it("출시 앱(1.13·1.14)이 이전 안내 버전으로 동의해도 다시 묻지 않고 그 버전의 업체(Gemini)로만 처리한다", async () => {
    // Given
    const answered = await answerConsent(true, "2026-10-26").expect(200);

    // When
    const response = await parseTodo("1.14.2");

    // Then
    expect(answered.body.data).toMatchObject({
      aiDataSharingDecision: "AGREED",
      aiDataSharingConsentVersion: "2026-10-26",
    });
    expect(response.status).toBe(200);
    expect(fakeAiGenerator.getLastRequest()?.agreedConsentVersion).toBe("2026-10-26");
  });

  it("새 안내에 동의하면 그 버전으로 생성기에 넘긴다", async () => {
    // Given
    await answerConsent(true).expect(200);

    // When
    await parseTodo("1.15.0").expect(200);

    // Then
    expect(fakeAiGenerator.getLastRequest()?.agreedConsentVersion).toBe(
      AI_DATA_SHARING_CONSENT.VERSION,
    );
  });

  it("지원하지 않는 안내 버전으로 답하면 400으로 거부한다", async () => {
    // When
    const response = await request(ctx.app.getHttpServer())
      .patch("/v1/auth/consent/ai-data-sharing")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ agreed: true, version: "2020-01-01" });

    // Then
    expect(response.status).toBe(400);
  });
});
