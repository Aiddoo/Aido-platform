import { JwtService } from "@nestjs/jwt";

import { SessionId } from "#api/modules/identity/auth/domain/session-id.vo";
import { JwtTokenIssuerAdapter } from "#api/modules/identity/auth/infrastructure/adapters/jwt-token-issuer.adapter";
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
});
