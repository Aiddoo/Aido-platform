import { resolveKmaForecastAvailability } from "./kma-forecast-availability.domain-service.js";

/** v1 앱은 `date=YYYY-MM-DD`를 보내고 서버는 그 날 UTC 자정(KST 09:00)으로 해석한다. */
function requestedDay(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

describe("resolveKmaForecastAvailability — KMA 단기예보 제공 범위", () => {
  it("오늘 날짜를 아침 발표 전(KST 04:18)에 요청하면 아직 없는 09시 발표 대신 지금의 발표를 쓴다", () => {
    // Given
    const now = new Date("2026-11-01T19:18:00.000Z");
    // When
    const availability = resolveKmaForecastAvailability({
      target: requestedDay("2026-11-02"),
      now: now,
    });
    // Then
    expect(availability).toEqual({
      kind: "AVAILABLE",
      timing: { target: requestedDay("2026-11-02"), issuance: now },
    });
  });

  it("오늘 발표가 이미 난 시각이면 요청 시각의 발표를 그대로 쓴다", () => {
    // Given
    const now = new Date("2026-11-02T03:00:00.000Z");
    const target = requestedDay("2026-11-02");
    // When
    const availability = resolveKmaForecastAvailability({ target: target, now: now });
    // Then
    expect(availability).toEqual({ kind: "AVAILABLE", timing: { target, issuance: target } });
  });

  it("KST 자정 직전과 직후로 오늘이 바뀌어 모레까지의 범위가 하루 밀린다", () => {
    // Given
    const beforeMidnight = new Date("2026-11-02T14:59:59.000Z");
    const afterMidnight = new Date("2026-11-02T15:00:00.000Z");
    const target = requestedDay("2026-11-05");
    // When
    const before = resolveKmaForecastAvailability({ target: target, now: beforeMidnight });
    const after = resolveKmaForecastAvailability({ target: target, now: afterMidnight });
    // Then
    expect(before.kind).toBe("UNAVAILABLE");
    expect(after).toEqual({
      kind: "AVAILABLE",
      timing: { target, issuance: afterMidnight },
    });
  });

  it("모레까지의 미래 날짜는 최신 발표로 당기고 글피는 제공하지 않는다", () => {
    // Given
    const now = new Date("2026-11-02T03:00:00.000Z");
    // When
    const dayAfterTomorrow = resolveKmaForecastAvailability({
      target: requestedDay("2026-11-04"),
      now: now,
    });
    const threeDaysLater = resolveKmaForecastAvailability({
      target: requestedDay("2026-11-05"),
      now: now,
    });
    // Then
    expect(dayAfterTomorrow).toEqual({
      kind: "AVAILABLE",
      timing: { target: requestedDay("2026-11-04"), issuance: now },
    });
    expect(threeDaysLater).toEqual({ kind: "UNAVAILABLE" });
  });

  it("오늘을 포함한 3일 전 날짜까지 제공하고 그보다 이른 날짜는 제공하지 않는다", () => {
    // Given
    const now = new Date("2026-11-02T03:00:00.000Z");
    // When
    const twoDaysAgo = resolveKmaForecastAvailability({
      target: requestedDay("2026-10-31"),
      now: now,
    });
    const threeDaysAgo = resolveKmaForecastAvailability({
      target: requestedDay("2026-10-30"),
      now: now,
    });
    // Then
    expect(twoDaysAgo).toEqual({
      kind: "AVAILABLE",
      timing: { target: requestedDay("2026-10-31"), issuance: requestedDay("2026-10-31") },
    });
    expect(threeDaysAgo).toEqual({ kind: "UNAVAILABLE" });
  });

  it("보관 첫날의 첫 발표(02:00) 전 시각은 그날 첫 발표로 당긴다", () => {
    // Given
    const now = new Date("2026-11-02T03:00:00.000Z");
    const earliestDayMidnight = new Date("2026-10-30T15:00:00.000Z");
    // When
    const availability = resolveKmaForecastAvailability({ target: earliestDayMidnight, now: now });
    // Then
    expect(availability).toEqual({
      kind: "AVAILABLE",
      timing: { target: earliestDayMidnight, issuance: new Date("2026-10-30T17:15:00.000Z") },
    });
  });
});
