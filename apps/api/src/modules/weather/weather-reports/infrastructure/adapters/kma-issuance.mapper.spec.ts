import {
  resolveKmaForecastAvailability,
  toKmaBaseDateTime,
  toPreviousKmaBaseDateTime,
} from "./kma-issuance.mapper.js";

const at = (text: string) => Temporal.Instant.from(text);

/** v1 앱은 `date=YYYY-MM-DD`를 보내고 서버는 그 날 UTC 자정(KST 09:00)으로 해석한다. */
const requestedDay = (day: string) => at(`${day}T00:00:00.000Z`);

describe("toKmaBaseDateTime — KMA 발표 시각 (KST)", () => {
  it.each([
    ["2026-03-18T01:00:00+09:00", "20260317", "2300"],
    ["2026-03-18T02:14:00+09:00", "20260317", "2300"],
    ["2026-03-18T02:15:00+09:00", "20260318", "0200"],
    ["2026-03-18T15:00:00+09:00", "20260318", "1400"],
    ["2026-03-18T23:59:00+09:00", "20260318", "2300"],
    ["2026-03-19T00:00:00+09:00", "20260318", "2300"],
    ["2026-04-01T00:30:00+09:00", "20260331", "2300"],
    ["2027-01-01T01:00:00+09:00", "20261231", "2300"],
    ["2028-03-01T01:00:00+09:00", "20280229", "2300"],
    ["2026-03-18T23:14:00+09:00", "20260318", "2000"],
    ["2026-03-18T23:15:00+09:00", "20260318", "2300"],
    ["2026-07-23T00:00:00Z", "20260723", "0800"],
  ])("%s는 %s/%s 발표를 선택한다", (instant, baseDate, baseTime) => {
    // Given
    const issuance = at(instant);

    // When
    const result = toKmaBaseDateTime(issuance);

    // Then
    expect(result).toEqual({ baseDate, baseTime });
  });

  it.each([
    ["2026-03-18T01:00:00+09:00", "20260317", "2000"],
    ["2026-03-18T02:14:00+09:00", "20260317", "2000"],
    ["2026-03-18T02:15:00+09:00", "20260317", "2300"],
    ["2026-03-18T05:15:00+09:00", "20260318", "0200"],
    ["2026-03-18T23:15:00+09:00", "20260318", "2000"],
    ["2027-01-01T02:30:00+09:00", "20261231", "2300"],
    ["2026-07-23T00:00:00Z", "20260723", "0500"],
  ])("%s의 직전 발표는 한 단계 전인 %s/%s 발표다", (instant, baseDate, baseTime) => {
    // Given
    const issuance = at(instant);

    // When
    const result = toPreviousKmaBaseDateTime(issuance);

    // Then
    expect(result).toEqual({ baseDate, baseTime });
  });
});

describe("resolveKmaForecastAvailability — KMA 단기예보 제공 범위", () => {
  it("오늘 날짜를 아침 발표 전(KST 04:18)에 요청하면 아직 없는 09시 발표 대신 지금의 발표를 쓴다", () => {
    // Given
    const now = at("2026-11-01T19:18:00.000Z");

    // When
    const availability = resolveKmaForecastAvailability({
      target: requestedDay("2026-11-02"),
      now,
    });

    // Then
    expect(availability).toEqual({
      kind: "AVAILABLE",
      timing: { target: requestedDay("2026-11-02"), issuance: now },
    });
  });

  it("오늘 발표가 이미 난 시각이면 요청 시각의 발표를 그대로 쓴다", () => {
    // Given
    const now = at("2026-11-02T03:00:00.000Z");
    const target = requestedDay("2026-11-02");

    // When
    const availability = resolveKmaForecastAvailability({ target, now });

    // Then
    expect(availability).toEqual({ kind: "AVAILABLE", timing: { target, issuance: target } });
  });

  it("KST 자정 직전과 직후로 오늘이 바뀌어 모레까지의 범위가 하루 밀린다", () => {
    // Given
    const beforeMidnight = at("2026-11-02T14:59:59.000Z");
    const afterMidnight = at("2026-11-02T15:00:00.000Z");
    const target = requestedDay("2026-11-05");

    // When
    const before = resolveKmaForecastAvailability({ target, now: beforeMidnight });
    const after = resolveKmaForecastAvailability({ target, now: afterMidnight });

    // Then
    expect(before.kind).toBe("UNAVAILABLE");
    expect(after).toEqual({ kind: "AVAILABLE", timing: { target, issuance: afterMidnight } });
  });

  it("모레까지의 미래 날짜는 최신 발표로 당기고 글피는 제공하지 않는다", () => {
    // Given
    const now = at("2026-11-02T03:00:00.000Z");

    // When
    const dayAfterTomorrow = resolveKmaForecastAvailability({
      target: requestedDay("2026-11-04"),
      now,
    });
    const threeDaysLater = resolveKmaForecastAvailability({
      target: requestedDay("2026-11-05"),
      now,
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
    const now = at("2026-11-02T03:00:00.000Z");

    // When
    const twoDaysAgo = resolveKmaForecastAvailability({ target: requestedDay("2026-10-31"), now });
    const threeDaysAgo = resolveKmaForecastAvailability({
      target: requestedDay("2026-10-30"),
      now,
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
    const now = at("2026-11-02T03:00:00.000Z");
    const earliestDayMidnight = at("2026-10-30T15:00:00.000Z");

    // When
    const availability = resolveKmaForecastAvailability({ target: earliestDayMidnight, now });

    // Then
    expect(availability).toEqual({
      kind: "AVAILABLE",
      timing: { target: earliestDayMidnight, issuance: at("2026-10-30T17:15:00.000Z") },
    });
  });
});
