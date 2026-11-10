import { instantFromDate, instantToDate, toIsoString } from "./instant.js";

describe("toIsoString — 순간 직렬화", () => {
  it.each([
    { label: "epoch, ms 0", epochMilliseconds: 0 },
    { label: "1970, ms 7", epochMilliseconds: 7 },
    { label: "1970, ms 70", epochMilliseconds: 70 },
    { label: "1970, ms 700", epochMilliseconds: 700 },
    { label: "1970 이전, ms 999", epochMilliseconds: -1 },
    { label: "2026-11-10, ms 0", epochMilliseconds: Date.UTC(2_026, 10, 10) },
    { label: "2026-11-10, ms 7", epochMilliseconds: Date.UTC(2_026, 10, 10, 9, 30, 15, 7) },
    { label: "2026-11-10, ms 70", epochMilliseconds: Date.UTC(2_026, 10, 10, 23, 59, 59, 70) },
    { label: "2026-11-10, ms 700", epochMilliseconds: Date.UTC(2_026, 10, 10, 12, 0, 0, 700) },
    { label: "2038 이후, ms 0", epochMilliseconds: Date.UTC(2_038, 0, 19, 3, 14, 8) },
    { label: "2038 이후, ms 7", epochMilliseconds: Date.UTC(2_100, 1, 28, 0, 0, 0, 7) },
    { label: "6자리 연도", epochMilliseconds: Date.UTC(10_000, 0, 1) },
  ])("$label: Date#toISOString과 같은 문자열을 낸다", ({ epochMilliseconds }) => {
    // Given
    const instant = Temporal.Instant.fromEpochMilliseconds(epochMilliseconds);

    // When
    const text = toIsoString(instant);

    // Then
    expect(text).toBe(new Date(epochMilliseconds).toISOString());
  });

  it("마이크로초가 있는 순간은 ms까지 잘라 Date로 바꾼 값과 같은 문자열을 낸다", () => {
    // Given
    const instant = Temporal.Instant.from("2026-11-10T00:00:00.123456789Z");

    // When
    const text = toIsoString(instant);

    // Then
    expect(text).toBe("2026-11-10T00:00:00.123Z");
    expect(text).toBe(instantToDate(instant).toISOString());
  });

  it("1970 이전의 마이크로초도 Date처럼 내림해 자른다", () => {
    // Given
    const instant = Temporal.Instant.fromEpochNanoseconds(-1n);

    // When
    const text = toIsoString(instant);

    // Then
    expect(text).toBe("1969-12-31T23:59:59.999Z");
    expect(text).toBe(instantToDate(instant).toISOString());
  });
});

describe("Date 경계 변환", () => {
  it("Date와 Instant를 오가도 같은 순간이다", () => {
    // Given
    const date = new Date("2026-11-10T09:30:15.007Z");

    // When
    const roundTrip = instantToDate(instantFromDate(date));

    // Then
    expect(roundTrip.getTime()).toBe(date.getTime());
  });
});
