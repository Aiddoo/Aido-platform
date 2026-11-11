import { evaluateSendCooldown } from "./send-cooldown.domain-service.js";

const LAST_SENT_AT = Temporal.Instant.from("2026-07-26T00:00:00Z");

describe("evaluateSendCooldown — 같은 대상 재전송 대기", () => {
  it("보낸 적이 없으면 대기가 없다", () => {
    // When
    const cooldown = evaluateSendCooldown({
      lastSentAt: null,
      cooldownHours: 24,
      now: LAST_SENT_AT,
    });

    // Then
    expect(cooldown).toEqual({ isActive: false, remainingSeconds: 0, endsAt: null });
  });

  it.each([
    {
      name: "끝나기 1ms 전",
      elapsed: { hours: 23, minutes: 59, seconds: 59, milliseconds: 999 },
      remainingSeconds: 1,
    },
    {
      name: "끝나기 1초 전",
      elapsed: { hours: 23, minutes: 59, seconds: 59 },
      remainingSeconds: 1,
    },
    { name: "방금 보낸 직후", elapsed: { milliseconds: 1 }, remainingSeconds: 86_400 },
  ])("$name에는 남은 시간을 초 단위로 올려 준다", ({ elapsed, remainingSeconds }) => {
    // When
    const cooldown = evaluateSendCooldown({
      lastSentAt: LAST_SENT_AT,
      cooldownHours: 24,
      now: LAST_SENT_AT.add(elapsed),
    });

    // Then
    expect(cooldown).toEqual({
      isActive: true,
      remainingSeconds,
      endsAt: Temporal.Instant.from("2026-07-27T00:00:00Z"),
    });
  });

  it("끝나는 시각부터는 다시 보낼 수 있다", () => {
    // When
    const cooldown = evaluateSendCooldown({
      lastSentAt: LAST_SENT_AT,
      cooldownHours: 1,
      now: LAST_SENT_AT.add({ hours: 1 }),
    });

    // Then
    expect(cooldown).toEqual({ isActive: false, remainingSeconds: 0, endsAt: null });
  });
});
