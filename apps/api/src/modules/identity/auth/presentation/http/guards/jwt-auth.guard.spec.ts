import { ErrorCode } from "@aido/api/errors";
import { Controller, Get } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host.js";
import { JwtService } from "@nestjs/jwt";

import { AuthenticateSessionUseCase } from "#api/modules/identity/auth/application/use-cases/authenticate-session.use-case";
import { SessionId } from "#api/modules/identity/auth/domain/session-id.vo";
import { JwtTokenIssuerAdapter } from "#api/modules/identity/auth/infrastructure/adapters/jwt-token-issuer.adapter";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  AUTH_FIXTURE_NOW,
  AUTH_FIXTURE_SESSION_ID,
  AUTH_FIXTURE_USER_ID,
  createAuthSessionFixture,
  createIdentityUserFixture,
} from "#test/fixtures/identity/auth-session.fixture";
import { type JwtTestAlgorithm, signJwtWithAlgorithm } from "#test/fixtures/jwt-token.fixture";

import { Public } from "../decorators/public.decorator.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { JwtRefreshGuard } from "./jwt-refresh.guard.js";

const JWT = {
  secret: "test-jwt-secret-at-least-32-characters-long",
  refreshSecret: "test-refresh-secret-at-least-32-characters",
  expiresIn: "15m",
  refreshExpiresIn: "7d",
};

// 1.15.0 이전(보안 강화 PR 전) TokenService가 발급하던 claim 그대로다. iss·aud가 없다
const PRE_DEPLOY_ACCESS_CLAIMS = {
  sub: AUTH_FIXTURE_USER_ID,
  email: "user@example.com",
  role: "USER",
  type: "access",
  sessionId: AUTH_FIXTURE_SESSION_ID,
};
const PRE_DEPLOY_REFRESH_CLAIMS = {
  ...PRE_DEPLOY_ACCESS_CLAIMS,
  type: "refresh",
  tokenFamily: "token-family",
  tokenVersion: 1,
};

@Controller()
class RoutesUnderTest {
  @Get("protected")
  protectedRoute(): void {}

  @Public()
  @Get("public")
  publicRoute(): void {}
}

interface TestRequest {
  readonly headers: { authorization?: string };
  user?: unknown;
}

function contextFor(
  request: TestRequest,
  handler: "protectedRoute" | "publicRoute" = "protectedRoute",
) {
  return new ExecutionContextHost(
    [request, {}],
    RoutesUnderTest,
    RoutesUnderTest.prototype[handler],
  );
}

function createAccessGuard(
  sessionLookup: () => Promise<never> | ReturnType<typeof createAuthSessionFixture> = () =>
    createAuthSessionFixture(),
) {
  const authenticateSession = new AuthenticateSessionUseCase({
    sessionRepository: { findById: async () => sessionLookup() },
    userRepository: { findById: async () => createIdentityUserFixture() },
    cache: { getSession: async () => undefined, setSession: async () => undefined },
    clock: new FixedClock(Temporal.Now.instant()),
    logger: new SilentLogger(),
  });
  return new JwtAuthGuard(new Reflector(), new JwtService(), JWT, authenticateSession);
}

async function activate(guard: JwtAuthGuard | JwtRefreshGuard, request: TestRequest) {
  try {
    await guard.canActivate(contextFor(request));
    return "accepted";
  } catch (error) {
    return error;
  }
}

describe("JwtAuthGuard — access 토큰 검증(Passport 대체)", () => {
  const sessionValidUntil = AUTH_FIXTURE_NOW.add({ hours: 24 * 3_650 });

  function validSessionGuard() {
    return createAccessGuard(() => createAuthSessionFixture({ expiresAt: sessionValidUntil }));
  }

  it("배포 전 발급한 access 토큰(iss·aud 없음)을 받아 req.user에 사용자를 둔다", async () => {
    // Given
    const token = signJwtWithAlgorithm(PRE_DEPLOY_ACCESS_CLAIMS, JWT.secret, "HS256");
    const request: TestRequest = { headers: { authorization: `Bearer ${token}` } };

    // When
    const outcome = await activate(validSessionGuard(), request);

    // Then
    expect(outcome).toBe("accepted");
    expect(request.user).toEqual({
      userId: AUTH_FIXTURE_USER_ID,
      email: "user@example.com",
      sessionId: AUTH_FIXTURE_SESSION_ID,
      role: "USER",
    });
  });

  // passport-jwt ExtractJwt.fromAuthHeaderAsBearerToken은 /(\S+)\s+(\S+)/로 앞 두 덩어리를 읽고 scheme을 소문자로 비교한다
  it.each([
    ["Bearer {token}", true],
    ["bearer {token}", true],
    ["BEARER {token}", true],
    ["Bearer   {token}", true],
    ["Bearer {token} extra", true],
    ["Bearer{token}", false],
    ["Basic {token}", false],
    ["{token}", false],
    [undefined, false],
  ])("Authorization %s 헤더는 Passport와 같게 처리한다(통과=%s)", async (header, isAccepted) => {
    // Given
    const token = signJwtWithAlgorithm(PRE_DEPLOY_ACCESS_CLAIMS, JWT.secret, "HS256");
    const request: TestRequest = { headers: { authorization: header?.replace("{token}", token) } };

    // When
    const outcome = await activate(validSessionGuard(), request);

    // Then
    if (isAccepted) {
      expect(outcome).toBe("accepted");
    } else {
      expect(outcome).toMatchObject({
        errorCode: ErrorCode.AUTH_0101,
        details: { reason: "Access token is missing or invalid" },
      });
    }
  });

  it.each<JwtTestAlgorithm>(["none", "HS512", "RS256"])(
    "%s로 서명한 토큰은 AUTH_0101이다",
    async (algorithm) => {
      // Given
      const token = signJwtWithAlgorithm(PRE_DEPLOY_ACCESS_CLAIMS, JWT.secret, algorithm);

      // When
      const outcome = await activate(validSessionGuard(), {
        headers: { authorization: `Bearer ${token}` },
      });

      // Then
      expect(outcome).toMatchObject({ errorCode: ErrorCode.AUTH_0101 });
    },
  );

  it("refresh 토큰을 access 자리에 보내면 서명이 달라 AUTH_0101이다", async () => {
    // Given
    const token = signJwtWithAlgorithm(PRE_DEPLOY_REFRESH_CLAIMS, JWT.refreshSecret, "HS256");

    // When
    const outcome = await activate(validSessionGuard(), {
      headers: { authorization: `Bearer ${token}` },
    });

    // Then
    expect(outcome).toMatchObject({ errorCode: ErrorCode.AUTH_0101 });
  });

  it("세션 거절(폐기 등)은 출시 앱이 아는 AUTH_0101로 감싸고 원래 문구를 reason에 둔다", async () => {
    // Given
    const token = signJwtWithAlgorithm(PRE_DEPLOY_ACCESS_CLAIMS, JWT.secret, "HS256");
    const guard = createAccessGuard(() =>
      createAuthSessionFixture({ expiresAt: sessionValidUntil, revokedAt: AUTH_FIXTURE_NOW }),
    );

    // When
    const outcome = await activate(guard, { headers: { authorization: `Bearer ${token}` } });

    // Then
    expect(outcome).toMatchObject({
      errorCode: ErrorCode.AUTH_0101,
      details: { reason: expect.any(String) },
    });
  });

  it("DB 장애 같은 인프라 오류는 401로 바꾸지 않고 그대로 던진다(앱 강제 로그아웃 방지)", async () => {
    // Given
    const token = signJwtWithAlgorithm(PRE_DEPLOY_ACCESS_CLAIMS, JWT.secret, "HS256");
    const guard = createAccessGuard(() => Promise.reject(new Error("connection terminated")));

    // When
    const outcome = await activate(guard, { headers: { authorization: `Bearer ${token}` } });

    // Then
    expect(outcome).toMatchObject({ message: "connection terminated" });
    expect(outcome).not.toHaveProperty("errorCode");
  });

  it("@Public() 라우트는 토큰 없이 통과한다", async () => {
    // Given
    const request: TestRequest = { headers: {} };

    // When
    const isActivated = await validSessionGuard().canActivate(contextFor(request, "publicRoute"));

    // Then
    expect(isActivated).toBe(true);
    expect(request.user).toBeUndefined();
  });

  it("새 코드가 iss·aud를 실어 발급한 토큰도 옛 검증 옵션(secret·HS256만)으로 통과해 롤백해도 로그인이 유지된다", async () => {
    // Given
    const issuer = new JwtTokenIssuerAdapter(new JwtService(), JWT);
    const { accessToken, refreshToken } = await issuer.generateTokenPair(
      UserId.reconstitute(AUTH_FIXTURE_USER_ID),
      "user@example.com",
      SessionId.reconstitute(AUTH_FIXTURE_SESSION_ID),
      "USER",
      "token-family",
      1,
    );
    const legacyVerifier = new JwtService();

    // When
    const access = await legacyVerifier.verifyAsync(accessToken, {
      secret: JWT.secret,
      algorithms: ["HS256"],
    });
    const refresh = await legacyVerifier.verifyAsync(refreshToken, {
      secret: JWT.refreshSecret,
      algorithms: ["HS256"],
    });

    // Then
    expect(access).toMatchObject({ ...PRE_DEPLOY_ACCESS_CLAIMS, iss: "aido-api", aud: "aido-app" });
    expect(refresh).toMatchObject(PRE_DEPLOY_REFRESH_CLAIMS);
  });
});

describe("JwtRefreshGuard — refresh 토큰 검증(Passport 대체)", () => {
  const guard = new JwtRefreshGuard(new JwtService(), JWT);

  it("배포 전 발급한 refresh 토큰을 받아 원본 토큰과 함께 req.user에 둔다", async () => {
    // Given
    const token = signJwtWithAlgorithm(PRE_DEPLOY_REFRESH_CLAIMS, JWT.refreshSecret, "HS256");
    const request: TestRequest = { headers: { authorization: `Bearer ${token}` } };

    // When
    const outcome = await activate(guard, request);

    // Then
    expect(outcome).toBe("accepted");
    expect(request.user).toEqual({
      userId: AUTH_FIXTURE_USER_ID,
      email: "user@example.com",
      sessionId: AUTH_FIXTURE_SESSION_ID,
      role: "USER",
      refreshToken: token,
    });
  });

  it.each([
    ["access 토큰", PRE_DEPLOY_ACCESS_CLAIMS, JWT.secret, "HS256"],
    ["access secret으로 서명한 refresh 토큰", PRE_DEPLOY_REFRESH_CLAIMS, JWT.secret, "HS256"],
    [
      "세션 id가 없는 토큰",
      { ...PRE_DEPLOY_REFRESH_CLAIMS, sessionId: "" },
      JWT.refreshSecret,
      "HS256",
    ],
    ["HS512 토큰", PRE_DEPLOY_REFRESH_CLAIMS, JWT.refreshSecret, "HS512"],
    ["서명 없는 토큰", PRE_DEPLOY_REFRESH_CLAIMS, JWT.refreshSecret, "none"],
  ] as const)("%s은 AUTH_0104다", async (_case, claims, secret, algorithm) => {
    // Given
    const token = signJwtWithAlgorithm(claims, secret, algorithm);

    // When
    const outcome = await activate(guard, { headers: { authorization: `Bearer ${token}` } });

    // Then
    expect(outcome).toMatchObject({ errorCode: ErrorCode.AUTH_0104 });
  });

  it("Authorization 헤더가 없으면 AUTH_0104다", async () => {
    // When
    const outcome = await activate(guard, { headers: {} });

    // Then
    expect(outcome).toMatchObject({ errorCode: ErrorCode.AUTH_0104 });
  });
});
