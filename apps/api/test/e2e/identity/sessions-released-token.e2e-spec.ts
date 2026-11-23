import { ErrorCode } from "@aido/api/errors";
import type { ConfigType } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { eq } from "drizzle-orm";
import request from "supertest";

import { TokenIssuerPort } from "#api/modules/identity/sessions/application/ports/token-issuer.port";
import { jwtConfig } from "#api/platform/config/jwt.config";
import { requireRecord } from "#api/platform/database/database-error.util";
import { session as sessionTable } from "#api/platform/database/schema/index";
import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "#test/e2e/helpers/e2e-app-factory";
import { decodeJwtSegment } from "#test/fixtures/identity/jwt-token.fixture";

// 1.15.3 전에 발급한 토큰(iss·aud 없음)은 refresh 수명 7일이 지나 모두 바뀌었으므로 거절한다
describe("발급자·대상 없는 옛 토큰 거절 E2E", () => {
  let testContext: E2eTestContext;
  const password = "Test1234!";

  beforeAll(async () => {
    testContext = await createE2eApp();
  });

  afterAll(async () => {
    await destroyE2eApp(testContext);
  });

  beforeEach(async () => {
    await testContext.reset();
  });

  // 1.15.3 전 TokenService와 같은 claim·HS256·secret으로 서명하고 iss·aud는 싣지 않는다
  async function givenPreIssuerTokens(email: string) {
    await testContext.helpers.createVerifiedUser(email, password);
    const login = await request(testContext.app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email, password })
      .expect(200);
    const tokenIssuer = testContext.module.get(TokenIssuerPort);
    const jwt = testContext.module.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY);
    const client = testContext.testDatabase.getClient();
    const session = requireRecord(
      await client.query.session.findFirst({
        where: { refreshTokenHash: tokenIssuer.hashRefreshToken(login.body.data.refreshToken) },
      }),
    );
    const preIssuerJwt = new JwtService();
    const claims = { sub: session.userId, email, role: "USER", sessionId: session.id };
    const accessToken = await preIssuerJwt.signAsync(
      { ...claims, type: "access" },
      { secret: jwt.secret, expiresIn: 900 },
    );
    const refreshToken = await preIssuerJwt.signAsync(
      {
        ...claims,
        type: "refresh",
        tokenFamily: session.tokenFamily,
        tokenVersion: session.tokenVersion,
      },
      { secret: jwt.refreshSecret, expiresIn: 7 * 24 * 60 * 60 },
    );
    // 세션이 이 refresh 토큰을 가리켜야 거절 이유가 iss·aud뿐이다
    const refreshTokenHash = tokenIssuer.hashRefreshToken(refreshToken);
    await client
      .update(sessionTable)
      .set({ refreshTokenHash })
      .where(eq(sessionTable.id, session.id));
    return { accessToken, refreshToken, refreshTokenHash, sessionId: session.id };
  }

  it("iss·aud 없는 access 토큰은 AUTH_0101, refresh 토큰은 회전하지 않고 AUTH_0104로 거절한다", async () => {
    // Given
    const released = await givenPreIssuerTokens("legacy-token@example.com");

    // When
    const me = await request(testContext.app.getHttpServer())
      .get("/v1/auth/me")
      .set("Authorization", `Bearer ${released.accessToken}`);
    const refreshed = await request(testContext.app.getHttpServer())
      .post("/v1/auth/refresh")
      .set("Authorization", `Bearer ${released.refreshToken}`);

    // Then
    expect(decodeJwtSegment(released.accessToken, 1)).not.toHaveProperty("iss");
    expect(decodeJwtSegment(released.refreshToken, 1)).not.toHaveProperty("aud");
    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe(ErrorCode.AUTH_0101);
    expect(refreshed.status).toBe(401);
    expect(refreshed.body.error.code).toBe(ErrorCode.AUTH_0104);
    const session = requireRecord(
      await testContext.testDatabase
        .getClient()
        .query.session.findFirst({ where: { id: released.sessionId } }),
    );
    expect(session).toMatchObject({ refreshTokenHash: released.refreshTokenHash, revokedAt: null });
  });
});
