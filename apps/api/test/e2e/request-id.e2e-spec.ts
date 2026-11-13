import { ErrorCode } from "@aido/api/errors";
import request from "supertest";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const APP_REQUEST_ID = "3f2b8c1e-5d4a-4b6f-9e2d-1a7c8b9d0e1f";

describe("요청 ID E2E", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  it("앱이 보낸 X-Request-Id를 응답 헤더로 그대로 돌려준다", async () => {
    // Given / When
    const response = await request(ctx.app.getHttpServer())
      .get("/v1/invites/availability")
      .set("X-Request-Id", APP_REQUEST_ID)
      .expect(200);

    // Then
    expect(response.headers["x-request-id"]).toBe(APP_REQUEST_ID);
  });

  it.each([
    ["보내지 않은 구 앱", undefined],
    ["UUID가 아닌 값", "not-a-uuid"],
  ])("%s 요청에는 새 UUID를 만들어 돌려준다", async (_name, requestId) => {
    // Given
    const call = request(ctx.app.getHttpServer()).get("/v1/invites/availability");

    // When
    const response = await (requestId == null ? call : call.set("X-Request-Id", requestId)).expect(
      200,
    );

    // Then
    expect(response.headers["x-request-id"]).toMatch(UUID_PATTERN);
  });

  it("guard가 거부한 오류 응답에도 같은 요청 ID를 돌려준다", async () => {
    // Given / When
    const response = await request(ctx.app.getHttpServer())
      .get("/v1/auth/me")
      .set("X-Request-Id", APP_REQUEST_ID)
      .expect(401);

    // Then
    expect(response.body.error.code).toBe(ErrorCode.AUTH_0101);
    expect(response.headers["x-request-id"]).toBe(APP_REQUEST_ID);
  });

  it("CORS가 X-Request-Id 요청 헤더를 받고 응답 헤더를 브라우저에 노출한다", async () => {
    // Given / When
    const preflight = await request(ctx.app.getHttpServer())
      .options("/v1/invites/availability")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "GET")
      .set("Access-Control-Request-Headers", "x-request-id")
      .expect(204);
    const response = await request(ctx.app.getHttpServer())
      .get("/v1/invites/availability")
      .set("Origin", "http://localhost:3000")
      .expect(200);

    // Then
    expect(String(preflight.headers["access-control-allow-headers"]).toLowerCase()).toContain(
      "x-request-id",
    );
    expect(String(response.headers["access-control-expose-headers"]).toLowerCase()).toContain(
      "x-request-id",
    );
  });
});
