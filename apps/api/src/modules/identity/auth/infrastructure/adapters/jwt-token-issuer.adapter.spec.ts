import { JwtService } from "@nestjs/jwt";

import { JwtTokenIssuerAdapter } from "#api/modules/identity/auth/infrastructure/adapters/jwt-token-issuer.adapter";
import { decodeJwtSegment, signJwtWithAlgorithm } from "#test/fixtures/jwt-token.fixture";

describe("JwtTokenIssuerAdapter — 서명 알고리즘 고정", () => {
  const accessSecret = "test-jwt-secret-at-least-32-chars";
  const refreshSecret = "test-refresh-secret-at-least-32-chars";
  let service: JwtTokenIssuerAdapter;

  beforeEach(() => {
    service = new JwtTokenIssuerAdapter(new JwtService(), {
      secret: accessSecret,
      refreshSecret,
      expiresIn: "15m",
      refreshExpiresIn: "7d",
    });
  });

  const claims = (type: "access" | "refresh") => ({
    sub: "user-id",
    email: "test@example.com",
    role: "USER",
    type,
    sessionId: "session-id",
  });

  it("새 토큰은 HS256으로 서명하고 발급자·대상을 싣는다", async () => {
    // Given
    const userId = "user-id";

    // When
    const pair = await service.generateTokenPair(userId, "test@example.com", "session-id", "USER");

    // Then
    for (const token of [pair.accessToken, pair.refreshToken]) {
      expect(decodeJwtSegment(token, 0)).toMatchObject({ alg: "HS256" });
      expect(decodeJwtSegment(token, 1)).toMatchObject({ iss: "aido-api", aud: "aido-app" });
    }
    await expect(service.verifyAccessTokenWithError(pair.accessToken)).resolves.toMatchObject({
      success: true,
    });
    await expect(service.verifyRefreshTokenWithError(pair.refreshToken)).resolves.toMatchObject({
      success: true,
    });
  });

  it("배포 전에 발급한 발급자·대상 없는 HS256 토큰도 통과한다", async () => {
    // Given
    const access = signJwtWithAlgorithm(claims("access"), accessSecret, "HS256");
    const refresh = signJwtWithAlgorithm(claims("refresh"), refreshSecret, "HS256");

    // When
    const accessResult = await service.verifyAccessTokenWithError(access);
    const refreshResult = await service.verifyRefreshTokenWithError(refresh);

    // Then
    expect(accessResult.success).toBe(true);
    expect(refreshResult.success).toBe(true);
  });

  it.each(["none", "HS512", "RS256"] as const)("%s 토큰은 거절한다", async (algorithm) => {
    // Given
    const access = signJwtWithAlgorithm(claims("access"), accessSecret, algorithm);
    const refresh = signJwtWithAlgorithm(claims("refresh"), refreshSecret, algorithm);

    // When
    const accessResult = await service.verifyAccessTokenWithError(access);
    const refreshResult = await service.verifyRefreshTokenWithError(refresh);

    // Then
    expect(accessResult.success).toBe(false);
    expect(refreshResult.success).toBe(false);
  });
});
