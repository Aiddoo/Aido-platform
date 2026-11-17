import { JwtService } from "@nestjs/jwt";
import { z } from "zod";

import { SessionId } from "#api/modules/identity/sessions/domain/session-id.vo";
import { JwtTokenIssuerAdapter } from "#api/modules/identity/sessions/infrastructure/adapters/jwt-token-issuer.adapter";
import { jwtSchema } from "#api/platform/config/schemas/jwt.schema";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { decodeJwtSegment } from "#test/fixtures/jwt-token.fixture";

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

  it("새 토큰은 HS256으로 서명하고 발급자·대상을 싣는다", async () => {
    // Given
    const userId = "user-id";

    // When
    const pair = await service.generateTokenPair(
      UserId.reconstitute(userId),
      "test@example.com",
      SessionId.reconstitute("session-id"),
      "USER",
    );

    // Then
    for (const token of [pair.accessToken, pair.refreshToken]) {
      expect(decodeJwtSegment(token, 0)).toMatchObject({ alg: "HS256" });
      expect(decodeJwtSegment(token, 1)).toMatchObject({ iss: "aido-api", aud: "aido-app" });
    }
  });

  it("기본 설정의 refresh 토큰은 발급 시각부터 30일 뒤 만료된다", async () => {
    // Given
    const defaults = jwtSchema.parse({
      JWT_SECRET: accessSecret,
      JWT_REFRESH_SECRET: refreshSecret,
    });
    const issuer = new JwtTokenIssuerAdapter(new JwtService(), {
      secret: accessSecret,
      refreshSecret,
      expiresIn: defaults.JWT_EXPIRES_IN,
      refreshExpiresIn: defaults.JWT_REFRESH_EXPIRES_IN,
    });

    // When
    const pair = await issuer.generateTokenPair(
      UserId.reconstitute("user-id"),
      "test@example.com",
      SessionId.reconstitute("session-id"),
      "USER",
    );

    // Then
    const claims = z
      .object({ iat: z.number(), exp: z.number() })
      .parse(decodeJwtSegment(pair.refreshToken, 1));
    expect(claims.exp - claims.iat).toBe(30 * 24 * 60 * 60);
    expect(issuer.getRefreshTokenExpiresInSeconds()).toBe(30 * 24 * 60 * 60);
  });

  it.each(["7 days", "1.5d", "0d", "-1d"])(
    "토큰 수명 %s는 예전처럼 15분으로 몰래 바꾸지 않고 설정 검증에서 막는다",
    (lifetime) => {
      // When
      const parsed = jwtSchema.safeParse({
        JWT_SECRET: accessSecret,
        JWT_REFRESH_SECRET: refreshSecret,
        JWT_REFRESH_EXPIRES_IN: lifetime,
      });

      // Then
      expect(parsed.success).toBe(false);
    },
  );
});
