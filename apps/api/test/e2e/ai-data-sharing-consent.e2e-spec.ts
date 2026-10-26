/**
 * AI 데이터 처리 동의 E2E 테스트
 *
 * 동의 저장·철회 API와, 1.13.0 이상 앱만 동의 없이 AI를 쓸 수 없게 하는 X-App-Version 경계를
 * 실제 앱과 PostgreSQL로 확인한다. 공급자는 FakeAiProvider로 막는다.
 */

import { AI_DATA_SHARING_CONSENT } from "@aido/api/vocabulary";
import request from "supertest";

import {
  AI_PROVIDER,
  AI_TASK_SETTINGS,
} from "#api/modules/ai-assistance/ai-assistance-parsing.public";
import { TEST_AI_TASK_SETTINGS_MAP_PARSING_V1 } from "#test/fixtures/ai-task-settings.fixture";

import { FakeAiProvider } from "../mocks/fake-ai.provider.js";
import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
  type VerifiedUser,
} from "./helpers/index.js";

describe("AI 데이터 처리 동의 E2E", () => {
  let ctx: E2eTestContext;
  let fakeAiProvider: FakeAiProvider;
  let user: VerifiedUser;

  beforeAll(async () => {
    fakeAiProvider = new FakeAiProvider();
    ctx = await createE2eApp({
      customizeBuilder: (builder) =>
        builder
          .overrideProvider(AI_PROVIDER)
          .useValue(fakeAiProvider)
          .overrideProvider(AI_TASK_SETTINGS)
          .useValue(TEST_AI_TASK_SETTINGS_MAP_PARSING_V1),
      additionalResetters: [() => fakeAiProvider.clear()],
    });
  }, 60000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.reset();
    user = await ctx.helpers.createVerifiedUser("ai-consent@example.com", "Test1234!");
    fakeAiProvider.setResponse({
      title: "팀 미팅",
      startDate: "2025-01-26",
      scheduledTime: "15:00",
      isAllDay: false,
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

  function answerConsent(agreed: boolean) {
    return request(ctx.app.getHttpServer())
      .patch("/v1/auth/consent/ai-data-sharing")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ agreed, version: AI_DATA_SHARING_CONSENT.VERSION });
  }

  it("1.13.0 앱은 동의하기 전 AI_1311을 받고 사용량도 차감하지 않으며 공급자를 부르지 않는다", async () => {
    // When
    const response = await parseTodo("1.13.0");

    // Then
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("AI_1311");
    expect(fakeAiProvider.getCallCount()).toBe(0);
    const usage = await request(ctx.app.getHttpServer())
      .get("/v1/ai/usage")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);
    expect(usage.body.data.data.used).toBe(0);
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

  it("현재가 아닌 안내 버전으로 답하면 400으로 거부한다", async () => {
    // When
    const response = await request(ctx.app.getHttpServer())
      .patch("/v1/auth/consent/ai-data-sharing")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ agreed: true, version: "2020-01-01" });

    // Then
    expect(response.status).toBe(400);
  });
});
