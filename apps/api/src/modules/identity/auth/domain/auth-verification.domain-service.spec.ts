import { createAuthVerificationFixture } from "#test/fixtures/identity/auth-credential.fixture";
import { AUTH_FIXTURE_NOW } from "#test/fixtures/identity/auth-session.fixture";

import {
  judgeVerificationAttempt,
  resendCooldownStartsAt,
} from "./auth-verification.domain-service.js";

describe("인증 코드 판단 — 재발송 대기와 시도 판정", () => {
  const correctHash = "digest:123456";
  const wrongHash = "digest:000000";

  it("재발송 대기는 지금보다 60초 앞선 시각부터 센다", () => {
    // Given
    const now = AUTH_FIXTURE_NOW;

    // When
    const startsAt = resendCooldownStartsAt(now);

    // Then
    expect(startsAt).toEqual(now.subtract({ seconds: 60 }));
  });

  it("쓸 수 없는 코드는 hash가 틀려도 불일치가 아니라 그 사유로 거부한다", () => {
    // Given
    const past = AUTH_FIXTURE_NOW.subtract({ minutes: 1 });
    const candidates = [
      null,
      createAuthVerificationFixture({ usedAt: past }),
      createAuthVerificationFixture({ expiresAt: AUTH_FIXTURE_NOW }),
      createAuthVerificationFixture({ attempts: 5 }),
      createAuthVerificationFixture(),
    ];

    // When
    const reasons = candidates.map((verification) => {
      const judgement = judgeVerificationAttempt({
        verification,
        tokenHash: wrongHash,
        now: AUTH_FIXTURE_NOW,
      });
      return judgement.ok ? "ok" : judgement.reason;
    });

    // Then
    expect(reasons).toEqual(["missing", "used", "expired", "exhausted", "mismatch"]);
  });

  it("쓸 수 있고 hash가 맞는 코드만 통과시킨다", () => {
    // Given
    const verification = createAuthVerificationFixture({ attempts: 4 });

    // When
    const judgement = judgeVerificationAttempt({
      verification,
      tokenHash: correctHash,
      now: AUTH_FIXTURE_NOW,
    });

    // Then
    expect(judgement).toEqual({ ok: true, verification });
  });
});
