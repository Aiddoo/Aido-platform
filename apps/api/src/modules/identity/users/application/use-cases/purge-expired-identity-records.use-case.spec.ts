import type { NewLoginAttempt } from "#api/modules/identity/sessions/application/ports/login-attempt.repository.port";
import { InMemoryLoginAttemptRepository } from "#test/doubles/identity/in-memory-login-attempt.repository";
import { InMemoryOAuthStateRepository } from "#test/doubles/identity/in-memory-oauth-state.repository";
import { InMemorySecurityLogRepository } from "#test/doubles/identity/in-memory-security-log.repository";
import { InMemorySessionRepository } from "#test/doubles/identity/in-memory-session.repository";
import { InMemoryVerificationRepository } from "#test/doubles/identity/in-memory-verification.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createVerificationFixture } from "#test/fixtures/identity/auth-credential.fixture";
import { AUTH_FIXTURE_NOW, createSessionFixture } from "#test/fixtures/identity/session.fixture";

import { PurgeExpiredIdentityRecordsUseCase } from "./purge-expired-identity-records.use-case.js";

const NOW = AUTH_FIXTURE_NOW;

function daysAgo(days: number): Temporal.Instant {
  return NOW.subtract({ hours: 24 * days });
}

function justOverDaysAgo(days: number): Temporal.Instant {
  return daysAgo(days).subtract({ milliseconds: 1 });
}

function loginAttempt(email: string, attemptedAt: Temporal.Instant): NewLoginAttempt {
  return { email, ipAddress: "127.0.0.1", userAgent: "Aido/1.16.0", success: false, attemptedAt };
}

function given(batchSize?: number) {
  const repositories = {
    sessionRepository: new InMemorySessionRepository(),
    loginAttemptRepository: new InMemoryLoginAttemptRepository(),
    verificationRepository: new InMemoryVerificationRepository(),
    oauthStateRepository: new InMemoryOAuthStateRepository(),
    securityLogRepository: new InMemorySecurityLogRepository(),
  };
  const useCase = new PurgeExpiredIdentityRecordsUseCase({
    ...repositories,
    clock: new FixedClock(NOW),
    logger: new SilentLogger(),
    batchSize,
  });
  return { ...repositories, useCase };
}

describe("PurgeExpiredIdentityRecordsUseCase", () => {
  it("테이블마다 보관 기한을 1ms라도 넘긴 기록만 지우고 경계와 쓰는 세션은 둔다", async () => {
    // Given
    const fixture = given();
    const sessions = [
      { id: "revoked-over", revokedAt: justOverDaysAgo(30), expiresAt: daysAgo(23) },
      { id: "revoked-at-boundary", revokedAt: daysAgo(30), expiresAt: daysAgo(23) },
      { id: "expired-over", revokedAt: null, expiresAt: justOverDaysAgo(30) },
      { id: "expired-at-boundary", revokedAt: null, expiresAt: daysAgo(30) },
      { id: "revoked-recently", revokedAt: NOW.subtract({ hours: 1 }), expiresAt: NOW },
      { id: "active", revokedAt: null, expiresAt: NOW.add({ hours: 24 * 7 }) },
    ];
    for (const { id, revokedAt, expiresAt } of sessions) {
      fixture.sessionRepository.seed(
        createSessionFixture({ id, refreshTokenHash: `hash-${id}`, revokedAt, expiresAt }),
      );
    }
    await fixture.loginAttemptRepository.create(
      loginAttempt("over@example.com", justOverDaysAgo(90)),
    );
    await fixture.loginAttemptRepository.create(loginAttempt("boundary@example.com", daysAgo(90)));
    const oneDayAfterExpiry = [
      { id: 1, expiresAt: justOverDaysAgo(1) },
      { id: 2, expiresAt: daysAgo(1) },
    ];
    for (const { id, expiresAt } of oneDayAfterExpiry) {
      await fixture.verificationRepository.save(
        createVerificationFixture({ id, tokenHash: `digest-${id}`, expiresAt }),
      );
      await fixture.oauthStateRepository.create({
        state: `state-${id}`,
        provider: "GOOGLE",
        redirectUri: "aido://auth/callback",
        expiresAt,
      });
    }
    const securityLog = { ipAddress: "127.0.0.1", userAgent: "Aido/1.16.0" };
    fixture.securityLogRepository.seed(
      { ...securityLog, event: "LOGIN_SUCCESS" },
      justOverDaysAgo(365),
    );
    fixture.securityLogRepository.seed({ ...securityLog, event: "LOGOUT" }, daysAgo(365));

    // When
    await fixture.useCase.execute();

    // Then
    expect(fixture.sessionRepository.all.map((session) => session.id)).toEqual([
      "revoked-at-boundary",
      "expired-at-boundary",
      "revoked-recently",
      "active",
    ]);
    expect(fixture.loginAttemptRepository.attempts.map((attempt) => attempt.email)).toEqual([
      "boundary@example.com",
    ]);
    expect(fixture.verificationRepository.all.map((verification) => verification.id)).toEqual([2]);
    expect(fixture.oauthStateRepository.all.map((state) => state.state)).toEqual(["state-2"]);
    expect(fixture.securityLogRepository.entries.map((entry) => entry.event)).toEqual(["LOGOUT"]);
  });

  it("한 묶음보다 많은 기록은 묶음을 이어 모두 지운다", async () => {
    // Given
    const fixture = given(2);
    for (const index of [1, 2, 3, 4, 5]) {
      fixture.sessionRepository.seed(
        createSessionFixture({
          id: `expired-${index}`,
          refreshTokenHash: `hash-${index}`,
          expiresAt: daysAgo(31),
        }),
      );
    }
    for (const index of [1, 2, 3, 4]) {
      await fixture.loginAttemptRepository.create(
        loginAttempt(`old-${index}@example.com`, daysAgo(91)),
      );
    }

    // When
    await fixture.useCase.execute();

    // Then
    expect(fixture.sessionRepository.all).toEqual([]);
    expect(fixture.loginAttemptRepository.attempts).toEqual([]);
  });
});
