import { ErrorCode } from "@aido/api/errors";
import { REVOKE_REASON } from "@aido/api/vocabulary";
import type { ConfigType } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { eq } from "drizzle-orm";
import request from "supertest";

import { AuthTokenIssuerPort } from "#api/modules/identity/auth/application/ports/auth-crypto.port";
import { TOKEN_REUSE_GRACE_PERIOD_MS } from "#api/modules/identity/auth/domain/auth.constants";
import { jwtConfig } from "#api/platform/config/jwt.config";
import { requireRecord } from "#api/platform/database/database-error.util";
import { session as sessionTable } from "#api/platform/database/schema/index";
import { decodeJwtSegment } from "#test/fixtures/jwt-token.fixture";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

// Passport를 걷어낸 뒤에도 배포 전에 로그인한 사용자가 로그아웃되지 않는지 본다
describe("배포 전 발급 토큰 호환 E2E", () => {
  let ctx: E2eTestContext;
  const password = "Test1234!";

  beforeAll(async () => {
    ctx = await createE2eApp();
  });

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  // 보안 강화(iss·aud) 전 TokenService와 같은 claim·HS256·secret으로 서명하고 iss·aud는 싣지 않는다
  async function givenPreDeployTokens(email: string) {
    await ctx.helpers.createVerifiedUser(email, password);
    const login = await request(ctx.app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email, password })
      .expect(200);
    const tokenIssuer = ctx.module.get(AuthTokenIssuerPort);
    const jwt = ctx.module.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY);
    const client = ctx.testDatabase.getClient();
    const session = requireRecord(
      await client.query.session.findFirst({
        where: { refreshTokenHash: tokenIssuer.hashRefreshToken(login.body.data.refreshToken) },
      }),
    );
    const legacyJwt = new JwtService();
    const claims = { sub: session.userId, email, role: "USER", sessionId: session.id };
    const accessToken = await legacyJwt.signAsync(
      { ...claims, type: "access" },
      { secret: jwt.secret, expiresIn: 900 },
    );
    const refreshToken = await legacyJwt.signAsync(
      {
        ...claims,
        type: "refresh",
        tokenFamily: session.tokenFamily,
        tokenVersion: session.tokenVersion,
      },
      { secret: jwt.refreshSecret, expiresIn: 7 * 24 * 60 * 60 },
    );
    await client
      .update(sessionTable)
      .set({ refreshTokenHash: tokenIssuer.hashRefreshToken(refreshToken) })
      .where(eq(sessionTable.id, session.id));
    return { accessToken, refreshToken, sessionId: session.id };
  }

  it("배포 전 access 토큰으로 보호된 API를 쓰고 배포 전 refresh 토큰으로 회전한다", async () => {
    // Given
    const legacy = await givenPreDeployTokens("legacy-token@example.com");

    // When
    const me = await request(ctx.app.getHttpServer())
      .get("/v1/auth/me")
      .set("Authorization", `Bearer ${legacy.accessToken}`);
    const refreshed = await request(ctx.app.getHttpServer())
      .post("/v1/auth/refresh")
      .set("Authorization", `Bearer ${legacy.refreshToken}`);

    // Then
    expect(decodeJwtSegment(legacy.accessToken, 1)).not.toHaveProperty("iss");
    expect(decodeJwtSegment(legacy.refreshToken, 1)).not.toHaveProperty("aud");
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe("legacy-token@example.com");
    expect(refreshed.status).toBe(200);
    await request(ctx.app.getHttpServer())
      .get("/v1/auth/me")
      .set("Authorization", `Bearer ${refreshed.body.data.accessToken}`)
      .expect(200);
  });

  it("grace가 지난 뒤 배포 전 refresh 토큰을 다시 쓰면 family 전체를 폐기하고 새 access도 막는다", async () => {
    // Given
    const legacy = await givenPreDeployTokens("legacy-reuse@example.com");
    const refreshed = await request(ctx.app.getHttpServer())
      .post("/v1/auth/refresh")
      .set("Authorization", `Bearer ${legacy.refreshToken}`)
      .expect(200);
    const client = ctx.testDatabase.getClient();
    await client
      .update(sessionTable)
      .set({
        lastUsedAt: Temporal.Now.instant().subtract({
          milliseconds: TOKEN_REUSE_GRACE_PERIOD_MS + 1_000,
        }),
      })
      .where(eq(sessionTable.id, legacy.sessionId));

    // When
    const reused = await request(ctx.app.getHttpServer())
      .post("/v1/auth/refresh")
      .set("Authorization", `Bearer ${legacy.refreshToken}`);
    const denied = await request(ctx.app.getHttpServer())
      .get("/v1/auth/me")
      .set("Authorization", `Bearer ${refreshed.body.data.accessToken}`);

    // Then
    expect(reused.status).toBe(401);
    expect(reused.body.error.code).toBe(ErrorCode.SESSION_0704);
    expect(denied.status).toBe(401);
    expect(denied.body.error.code).toBe(ErrorCode.AUTH_0101);
    const revoked = requireRecord(
      await client.query.session.findFirst({ where: { id: legacy.sessionId } }),
    );
    expect(revoked.revokedReason).toBe(REVOKE_REASON.TOKEN_REUSE_DETECTED);
  });

  it("배포 전 access 토큰으로 로그아웃하면 같은 토큰은 AUTH_0101로 막힌다", async () => {
    // Given
    const legacy = await givenPreDeployTokens("legacy-logout@example.com");

    // When
    await request(ctx.app.getHttpServer())
      .post("/v1/auth/logout")
      .set("Authorization", `Bearer ${legacy.accessToken}`)
      .expect(200);
    const denied = await request(ctx.app.getHttpServer())
      .get("/v1/auth/me")
      .set("Authorization", `Bearer ${legacy.accessToken}`);

    // Then
    expect(denied.status).toBe(401);
    expect(denied.body.error.code).toBe(ErrorCode.AUTH_0101);
  });

  it("access 토큰을 refresh에 보내면 AUTH_0104다", async () => {
    // Given
    const legacy = await givenPreDeployTokens("legacy-wrong-type@example.com");

    // When
    const response = await request(ctx.app.getHttpServer())
      .post("/v1/auth/refresh")
      .set("Authorization", `Bearer ${legacy.accessToken}`);

    // Then
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(ErrorCode.AUTH_0104);
  });
});
