import { ErrorCode } from "@aido/api/errors";
import request from "supertest";

import { SubscriptionEventBuilder } from "#test/builders/subscription-event.builder";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const webhookSecret = "production-config-e2e-webhook-secret";

describe("운영 설정(APP_ENV=production)으로 띄운 앱 (실제 PostgreSQL)", () => {
  let context: E2eTestContext;

  beforeAll(async () => {
    context = await createE2eApp({
      env: { APP_ENV: "production", REVENUECAT_WEBHOOK_SECRET: webhookSecret },
    });
  });

  beforeEach(async () => {
    await context.reset();
  });

  afterAll(async () => {
    await destroyE2eApp(context);
  });

  function server() {
    return request(context.app.getHttpServer());
  }

  it("검증 실패와 없는 경로의 오류 응답에 개발용 상세를 싣지 않는다", async () => {
    // When
    const invalidBody = await server().post("/v1/auth/login").send({ email: 1 }).expect(400);
    const missingRoute = await server().get("/v1/production-config-missing-route").expect(404);

    // Then
    expect(invalidBody.body.error.code).toBe(ErrorCode.SYS_0002);
    expect(invalidBody.body.error).not.toHaveProperty("details");
    expect(missingRoute.body.error).not.toHaveProperty("details");
  });

  it("RevenueCat 웹훅은 Authorization이 없거나 다르면 거절하고 맞으면 받는다", async () => {
    // Given
    const body = SubscriptionEventBuilder.test()
      .withAppUserId("production-config-user")
      .withEventId("production-config-event")
      .build();

    // When
    const missing = await server().post("/v1/webhooks/revenuecat").send(body).expect(401);
    const wrong = await server()
      .post("/v1/webhooks/revenuecat")
      .set("Authorization", "Bearer wrong-secret")
      .send(body)
      .expect(401);
    const accepted = await server()
      .post("/v1/webhooks/revenuecat")
      .set("Authorization", `Bearer ${webhookSecret}`)
      .send(body)
      .expect(200);

    // Then
    expect(missing.body.error.code).toBe(ErrorCode.SUBSCRIPTION_1601);
    expect(wrong.body.error.code).toBe(ErrorCode.SUBSCRIPTION_1601);
    expect(accepted.body.data).toEqual({ received: true });
  });

  it.each(["/api/docs", "/api/docs-json", "/api/admin/docs"])(
    "Swagger 경로 %s를 열지 않는다",
    async (path) => {
      // When
      const response = await server().get(path);

      // Then
      expect(response.status).toBe(404);
    },
  );

  it("공개 /health는 큐 이름·실패 수·런타임 수치 없이 전체 상태만 준다", async () => {
    // When
    const response = await server().get("/health").expect(200);

    // Then
    expect(response.body.data).toEqual({ status: "ok" });
    expect(JSON.stringify(response.body)).not.toMatch(/\.v1|queues|runtime|instanceId/);
  });

  it("CORS는 localhost 개발 출처를 허용하지 않고 랜딩 출처는 허용한다", async () => {
    // When
    const local = await server()
      .options("/v1/auth/login")
      .set("Origin", "http://localhost:19006")
      .set("Access-Control-Request-Method", "POST");
    const landing = await server()
      .options("/v1/auth/login")
      .set("Origin", "https://aido.kr")
      .set("Access-Control-Request-Method", "POST");

    // Then
    expect(local.headers["access-control-allow-origin"]).toBeUndefined();
    expect(landing.headers["access-control-allow-origin"]).toBe("https://aido.kr");
  });
});
