import { groupTimezonesByLocalClock } from "./local-clock.domain-service.js";

const clockOf = (minute: string, timezones: readonly string[]) =>
  groupTimezonesByLocalClock(Temporal.Instant.from(minute), timezones).map(
    ({ timezones: group, today, localHour, localMinute, dayOfWeek }) => ({
      timezones: group,
      clock: `${today.toString()} ${localHour}:${localMinute} ${dayOfWeek}`,
    }),
  );

describe("groupTimezonesByLocalClock", () => {
  it("그 분에 오프셋이 같은 시간대를 한 묶음으로 둔다", () => {
    // When
    const groups = clockOf("2024-01-16T23:00:00Z", [
      "Asia/Seoul",
      "America/New_York",
      "Asia/Tokyo",
    ]);

    // Then
    expect(groups).toEqual([
      { timezones: ["Asia/Seoul", "Asia/Tokyo"], clock: "2024-01-17 8:0 3" },
      { timezones: ["America/New_York"], clock: "2024-01-16 18:0 2" },
    ]);
  });

  it("시:분이 같아도 날짜가 다르면 따로 묶는다", () => {
    // When: 키리티마시(+14)와 호놀룰루(-10)는 같은 시각, 다른 날이다
    const groups = clockOf("2024-01-16T23:00:00Z", ["Pacific/Kiritimati", "Pacific/Honolulu"]);

    // Then
    expect(groups).toEqual([
      { timezones: ["Pacific/Kiritimati"], clock: "2024-01-17 13:0 3" },
      { timezones: ["Pacific/Honolulu"], clock: "2024-01-16 13:0 2" },
    ]);
  });

  it("서머타임으로 오프셋이 바뀐 날에는 평소 같은 묶음이던 시간대를 나눈다", () => {
    // When: 2024-03-10 미국은 서머타임 시작, 서스캐처원(Regina)은 그대로다
    const winter = clockOf("2024-03-09T18:00:00Z", ["America/Chicago", "America/Regina"]);
    const summer = clockOf("2024-03-10T18:00:00Z", ["America/Chicago", "America/Regina"]);

    // Then
    expect(winter.map(({ timezones }) => timezones)).toEqual([
      ["America/Chicago", "America/Regina"],
    ]);
    expect(summer.map(({ timezones }) => timezones)).toEqual([
      ["America/Chicago"],
      ["America/Regina"],
    ]);
  });

  it("30분 오프셋 시간대는 정시 오프셋과 묶지 않는다", () => {
    // When
    const groups = clockOf("2024-01-16T03:30:00Z", ["Asia/Kolkata", "Asia/Dhaka"]);

    // Then
    expect(groups).toEqual([
      { timezones: ["Asia/Kolkata"], clock: "2024-01-16 9:0 2" },
      { timezones: ["Asia/Dhaka"], clock: "2024-01-16 9:30 2" },
    ]);
  });
});
