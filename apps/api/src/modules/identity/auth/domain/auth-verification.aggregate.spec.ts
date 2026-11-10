import { createAuthVerificationFixture } from "#test/fixtures/identity/auth-credential.fixture";
import {
  AUTH_FIXTURE_NOW,
  AUTH_FIXTURE_USER_ID,
} from "#test/fixtures/identity/auth-session.fixture";

import { AuthVerification } from "./auth-verification.aggregate.js";
import { VerificationId } from "./verification-id.vo.js";

describe("AuthVerification — 인증 코드 발급과 유효성", () => {
  it("새 코드는 지금부터 10분 뒤 만료되고 시도 0회·미사용으로 만든다", () => {
    // Given
    const params = {
      id: VerificationId.reconstitute(7),
      userId: AUTH_FIXTURE_USER_ID,
      type: "PASSWORD_RESET",
      tokenHash: "digest:123456",
      now: AUTH_FIXTURE_NOW,
    } as const;

    // When
    const verification = AuthVerification.create(params);

    // Then
    expect(verification.toPrimitives()).toEqual({
      id: 7,
      userId: AUTH_FIXTURE_USER_ID,
      type: "PASSWORD_RESET",
      tokenHash: "digest:123456",
      expiresAt: AUTH_FIXTURE_NOW.add({ minutes: 10 }),
      attempts: 0,
      usedAt: null,
      createdAt: AUTH_FIXTURE_NOW,
    });
  });

  it("만료 시각 직전까지 유효하고 만료 시각과 같은 순간부터 만료다", () => {
    // Given
    const verification = createAuthVerificationFixture({ expiresAt: AUTH_FIXTURE_NOW });

    // When
    const validities = [
      verification.validityAt(AUTH_FIXTURE_NOW.subtract({ milliseconds: 1 })),
      verification.validityAt(AUTH_FIXTURE_NOW),
    ];

    // Then
    expect(validities).toEqual(["valid", "expired"]);
  });

  it("사용·만료·소진 순서로 판단하고 시도 5회부터 소진이다", () => {
    // Given
    const past = AUTH_FIXTURE_NOW.subtract({ minutes: 1 });
    const verifications = [
      createAuthVerificationFixture({ usedAt: past, expiresAt: past, attempts: 5 }),
      createAuthVerificationFixture({ expiresAt: past, attempts: 5 }),
      createAuthVerificationFixture({ attempts: 5 }),
      createAuthVerificationFixture({ attempts: 4 }),
    ];

    // When
    const validities = verifications.map((verification) =>
      verification.validityAt(AUTH_FIXTURE_NOW),
    );

    // Then
    expect(validities).toEqual(["used", "expired", "exhausted", "valid"]);
  });
});
