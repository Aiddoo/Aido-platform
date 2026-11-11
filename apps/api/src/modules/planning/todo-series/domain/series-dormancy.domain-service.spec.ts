import { isDormantSince, isSeriesOwnerDormant } from "./series-dormancy.domain-service.js";

const OWNER = {
  lastActiveAt: Temporal.Instant.from("2026-09-06T03:00:00.000Z"),
  signedUpAt: Temporal.Instant.from("2026-01-01T03:00:00.000Z"),
  timezone: "Asia/Seoul",
};

describe("isSeriesOwnerDormant — 휴면 판단", () => {
  it.each([
    { name: "59일째는 휴면이 아니다", at: "2026-11-04T03:00:00.000Z", expected: false },
    { name: "정확히 60일째는 휴면이 아니다", at: "2026-11-05T03:00:00.000Z", expected: false },
    { name: "60일째 마지막 순간도 휴면이 아니다", at: "2026-11-05T14:59:59.000Z", expected: false },
    { name: "61일째 자정부터 휴면이다", at: "2026-11-05T15:00:00.000Z", expected: true },
  ])("$name", ({ at, expected }) => {
    // When
    const dormant = isSeriesOwnerDormant(OWNER, Temporal.Instant.from(at));
    // Then
    expect(dormant).toBe(expected);
  });

  it.each([
    { timezone: "Asia/Seoul", expected: true },
    { timezone: "America/Los_Angeles", expected: false },
  ])("같은 순간이라도 $timezone 달력으로 잰다", ({ timezone, expected }) => {
    // Given
    const owner = {
      ...OWNER,
      lastActiveAt: Temporal.Instant.from("2026-09-06T12:00:00.000Z"),
      timezone,
    };
    // When
    const dormant = isSeriesOwnerDormant(owner, Temporal.Instant.from("2026-11-05T15:00:00.000Z"));
    // Then
    expect(dormant).toBe(expected);
  });

  it.each([
    { name: "설정 행이 없으면", timezone: null },
    { name: "기본값 UTC에 머물렀으면", timezone: "UTC" },
    { name: "잘못 저장됐으면", timezone: "Mars/Olympus" },
  ])("$name 한국 달력으로 잰다", ({ timezone }) => {
    // Given
    const owner = { ...OWNER, timezone };
    // When
    const dormant = isSeriesOwnerDormant(owner, Temporal.Instant.from("2026-11-05T15:00:00.000Z"));
    // Then
    expect(dormant).toBe(true);
  });

  it("활동 기록이 없으면 가입일로 잰다", () => {
    // Given
    const justSignedUp = {
      lastActiveAt: null,
      signedUpAt: Temporal.Instant.from("2026-09-06T03:00:00.000Z"),
      timezone: "Asia/Seoul",
    };
    // When
    const onDay60 = isSeriesOwnerDormant(
      justSignedUp,
      Temporal.Instant.from("2026-11-05T03:00:00.000Z"),
    );
    const onDay61 = isSeriesOwnerDormant(
      justSignedUp,
      Temporal.Instant.from("2026-11-06T03:00:00.000Z"),
    );
    // Then
    expect(onDay60).toBe(false);
    expect(onDay61).toBe(true);
  });

  it("윤일을 지나도 달력 날짜로 센다", () => {
    // Given
    const lastMovedAt = Temporal.Instant.from("2028-01-15T00:00:00.000Z");
    // When
    const onDay60 = isDormantSince(
      lastMovedAt,
      "UTC",
      Temporal.Instant.from("2028-03-15T00:00:00.000Z"),
    );
    const onDay61 = isDormantSince(
      lastMovedAt,
      "UTC",
      Temporal.Instant.from("2028-03-16T00:00:00.000Z"),
    );
    // Then
    expect(onDay60).toBe(false);
    expect(onDay61).toBe(true);
  });
});
