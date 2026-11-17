import { createVerificationFixture } from "#test/fixtures/identity/auth-credential.fixture";
import { AUTH_FIXTURE_NOW } from "#test/fixtures/identity/session.fixture";

import {
  judgeVerificationAttempt,
  judgeVerificationEmailCap,
  sentAtsInEmailCapWindow,
  resendCooldownStartsAt,
} from "./verification.domain-service.js";

function sentEveryHour(count: number): Temporal.Instant[] {
  return Array.from({ length: count }, (_, index) => AUTH_FIXTURE_NOW.add({ hours: index }));
}

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
      createVerificationFixture({ usedAt: past }),
      createVerificationFixture({ expiresAt: AUTH_FIXTURE_NOW }),
      createVerificationFixture({ attempts: 5 }),
      createVerificationFixture(),
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
    const verification = createVerificationFixture({ attempts: 4 });

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

describe("이메일 코드 상한 — 기준마다 24시간 창 안 상한", () => {
  it("창 안에 상한보다 하나 적으면 보낼 수 있다", () => {
    // Given
    const counts = [{ sentAts: sentEveryHour(9), maxCodes: 10 }];

    // When
    const judgement = judgeVerificationEmailCap(counts, AUTH_FIXTURE_NOW.add({ hours: 9 }));

    // Then
    expect(judgement).toEqual({ ok: true });
  });

  it("창 안에 상한만큼 있으면 막고 남은 초는 출시 앱의 다시 보내기 대기인 60초를 넘지 않는다", () => {
    // Given
    const counts = [{ sentAts: sentEveryHour(10).toReversed(), maxCodes: 10 }];

    // When
    const judgement = judgeVerificationEmailCap(counts, AUTH_FIXTURE_NOW.add({ hours: 10 }));

    // Then
    expect(judgement).toEqual({ ok: false, remainingSeconds: 60 });
  });

  it("가장 오래된 코드가 1분 안에 창을 벗어나면 그때까지 남은 초를 준다", () => {
    // Given
    const counts = [{ sentAts: sentEveryHour(10), maxCodes: 10 }];

    // When
    const judgement = judgeVerificationEmailCap(
      counts,
      AUTH_FIXTURE_NOW.add({ hours: 24 }).subtract({ seconds: 15 }),
    );

    // Then
    expect(judgement).toEqual({ ok: false, remainingSeconds: 15 });
  });

  it("여러 기준 중 하나라도 차면 막고 남은 초는 가장 늦게 풀리는 기준을 따른다", () => {
    // Given
    const now = AUTH_FIXTURE_NOW.add({ hours: 24 }).subtract({ seconds: 15 });
    const counts = [
      { sentAts: sentEveryHour(3), maxCodes: 20 },
      { sentAts: sentEveryHour(5), maxCodes: 5 },
      { sentAts: [AUTH_FIXTURE_NOW.add({ seconds: 5 })], maxCodes: 1 },
    ];

    // When
    const judgement = judgeVerificationEmailCap(counts, now);

    // Then
    expect(judgement).toEqual({ ok: false, remainingSeconds: 20 });
  });

  it("보낸 지 24시간 정각부터 창 밖이라 다시 보낼 수 있고 창 안 기록만 남긴다", () => {
    // Given
    const sentAts = sentEveryHour(10);
    const now = AUTH_FIXTURE_NOW.add({ hours: 24 });

    // When
    const judgement = judgeVerificationEmailCap([{ sentAts, maxCodes: 10 }], now);
    const inWindow = sentAtsInEmailCapWindow(sentAts.toReversed(), now);

    // Then
    expect(judgement).toEqual({ ok: true });
    expect(inWindow).toEqual(sentAts.slice(1));
  });
});
