import { ErrorCode } from "@aido/api/errors";
import { PUSH_DEVICE_ID_MAX_LENGTH } from "@aido/api/vocabulary";
import request from "supertest";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "#test/e2e/helpers/e2e-app-factory";

describe("앱 HTTP 경계 E2E", () => {
  let testContext: E2eTestContext;

  beforeAll(async () => {
    testContext = await createE2eApp();
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(testContext);
  });

  beforeEach(async () => {
    await testContext.reset();
  });

  it("API는 /v1 아래에서만 성공 envelope로 응답한다", async () => {
    // When
    const versioned = await request(testContext.app.getHttpServer()).get(
      "/v1/invites/availability",
    );
    const unversioned = await request(testContext.app.getHttpServer()).get("/invites/availability");

    // Then
    expect(versioned.status).toBe(200);
    expect(versioned.body).toEqual({
      success: true,
      data: { enabled: expect.any(Boolean) },
      timestamp: expect.any(Number),
    });
    expect(unversioned.status).toBe(404);
  });

  it("기본 한도 100KB를 넘는 본문은 경로와 상관없이 413 SYS_0002로 거절한다", async () => {
    // Given
    const tooLarge = { email: "body@test.com", password: "a".repeat(101 * 1024) };

    // When
    const response = await request(testContext.app.getHttpServer())
      .post("/v1/auth/login")
      .send(tooLarge);

    // Then
    expect(response.status).toBe(413);
    expect(response.body).toMatchObject({ success: false, error: { code: ErrorCode.SYS_0002 } });
  });

  it("__proto__ 키가 있는 JSON 본문은 400 SYS_0002로 거절한다", async () => {
    // When
    const response = await request(testContext.app.getHttpServer())
      .post("/v1/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":"proto@test.com","password":"Test1234!","__proto__":{"admin":true}}');

    // Then
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false, error: { code: ErrorCode.SYS_0002 } });
  });

  it("100자를 넘는 경로 파라미터도 라우트에 닿아 계약 검증의 400 SYS_0002를 받는다", async () => {
    // Given
    const user = await testContext.helpers.createVerifiedUser("long-param@test.com", "Test1234!");
    const deviceId = `ios_${"a".repeat(PUSH_DEVICE_ID_MAX_LENGTH)}`;

    // When
    const response = await request(testContext.app.getHttpServer())
      .put(`/v1/notifications/push-devices/${deviceId}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        permission: { status: "DENIED", canAskAgain: false },
        token: null,
        payloadVersion: 2,
      });

    // Then
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false, error: { code: ErrorCode.SYS_0002 } });
  });

  it("디코딩해 256자를 넘는 경로 파라미터는 라우트 전에 414 SYS_0002로 답한다", async () => {
    // When
    const response = await request(testContext.app.getHttpServer())
      .put(`/v1/notifications/push-devices/ios_${"a".repeat(256)}`)
      .send({});

    // Then
    expect(response.status).toBe(414);
    expect(response.body).toMatchObject({ success: false, error: { code: ErrorCode.SYS_0002 } });
  });

  it.each([
    ["라우트가 없는 404", "/v1/does-not-exist", 404],
    ["라우터가 디코딩하지 못한 경로의 400", "/v1/todos/%FF", 400],
  ])("%s도 보안 헤더와 SYS_0002 envelope로 답한다", async (_case, path, status) => {
    // When
    const response = await request(testContext.app.getHttpServer()).get(path);

    // Then
    expect(response.status).toBe(status);
    expect(response.body).toMatchObject({ success: false, error: { code: ErrorCode.SYS_0002 } });
    expect(response.headers).toMatchObject({
      "x-content-type-options": "nosniff",
      "x-frame-options": "SAMEORIGIN",
      "strict-transport-security": "max-age=31536000; includeSubDomains",
      "content-security-policy": expect.stringContaining("default-src 'self'"),
    });
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("CORS preflight가 X-Timezone 요청 헤더를 허용한다", async () => {
    // When
    const response = await request(testContext.app.getHttpServer())
      .options("/v1/invites/availability")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "GET")
      .set("Access-Control-Request-Headers", "x-timezone")
      .expect(204);

    // Then
    // 브라우저가 실제 인증 요청을 보낼 수 있도록 명시적으로 허용한다
    const allowedHeaders = String(response.headers["access-control-allow-headers"])
      .toLowerCase()
      .split(",")
      .map((header) => header.trim());
    expect(allowedHeaders).toContain("x-timezone");
  });
});
