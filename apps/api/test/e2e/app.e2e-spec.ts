import { ErrorCode } from "@aido/api/errors";
import request from "supertest";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("앱 HTTP 경계 E2E", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  it("API는 /v1 아래에서만 성공 envelope로 응답한다", async () => {
    // When
    const versioned = await request(ctx.app.getHttpServer()).get("/v1/invites/availability");
    const unversioned = await request(ctx.app.getHttpServer()).get("/invites/availability");

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
    const response = await request(ctx.app.getHttpServer()).post("/v1/auth/login").send(tooLarge);

    // Then
    expect(response.status).toBe(413);
    expect(response.body).toMatchObject({ success: false, error: { code: ErrorCode.SYS_0002 } });
  });

  it("CORS preflight가 X-Timezone 요청 헤더를 허용한다", async () => {
    // When - 웹 클라이언트가 timezone 헤더를 포함한 preflight를 보내면
    const response = await request(ctx.app.getHttpServer())
      .options("/v1/invites/availability")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "GET")
      .set("Access-Control-Request-Headers", "x-timezone")
      .expect(204);

    // Then - 브라우저가 실제 인증 요청을 보낼 수 있도록 명시적으로 허용한다
    const allowedHeaders = String(response.headers["access-control-allow-headers"])
      .toLowerCase()
      .split(",")
      .map((header) => header.trim());
    expect(allowedHeaders).toContain("x-timezone");
  });
});
