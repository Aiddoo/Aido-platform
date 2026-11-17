import { groupTimezonesByLocalClock, reminderTimesDueAt } from "./local-clock.domain-service.js";

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
    // When
    // 키리티마시(+14)와 호놀룰루(-10)는 같은 시각, 다른 날이다
    const groups = clockOf("2024-01-16T23:00:00Z", ["Pacific/Kiritimati", "Pacific/Honolulu"]);

    // Then
    expect(groups).toEqual([
      { timezones: ["Pacific/Kiritimati"], clock: "2024-01-17 13:0 3" },
      { timezones: ["Pacific/Honolulu"], clock: "2024-01-16 13:0 2" },
    ]);
  });

  it("서머타임으로 오프셋이 바뀐 날에는 평소 같은 묶음이던 시간대를 나눈다", () => {
    // When
    // 2024-03-10 미국은 서머타임 시작, 서스캐처원(Regina)은 그대로다
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

// 그 날 현지 자정부터 몇 시간 동안 매분 sweep을 돌려 그 시:분이 울리는 분을 오프셋과 함께 모은다
function sweepMinutesWhenDue(
  timezone: string,
  date: string,
  time: { readonly hour: number; readonly minute: number },
  hours = 5,
): string[] {
  const start = Temporal.PlainDate.from(date).toZonedDateTime(timezone).toInstant();
  return Array.from({ length: hours * 60 }, (_, index) => start.add({ minutes: index }))
    .filter((minute) =>
      reminderTimesDueAt(minute, timezone).some(
        ({ hour, minute: dueMinute }) => hour === time.hour && dueMinute === time.minute,
      ),
    )
    .map((minute) => {
      const local = minute.toZonedDateTimeISO(timezone);
      return `${local.toPlainTime().toString({ smallestUnit: "minute" })}${local.offset}`;
    });
}

describe("reminderTimesDueAt", () => {
  it("평소에는 그 시:분부터 grace(3분) 동안 울린다", () => {
    // When
    const due = sweepMinutesWhenDue("Asia/Seoul", "2027-03-14", { hour: 2, minute: 30 });

    // Then
    expect(due).toEqual(["02:30+09:00", "02:31+09:00", "02:32+09:00"]);
  });

  it.each([
    {
      timezone: "America/New_York",
      date: "2027-03-14",
      expected: ["03:00-04:00", "03:01-04:00", "03:02-04:00"],
      time: { hour: 2, minute: 30 },
    },
    {
      timezone: "Europe/London",
      date: "2027-03-28",
      expected: ["02:00+01:00", "02:01+01:00", "02:02+01:00"],
      time: { hour: 1, minute: 30 },
    },
  ])(
    "$timezone 봄 DST 틈에 없는 시각은 틈 바로 뒤 첫 분부터 울린다($date)",
    ({ timezone, date, time, expected }) => {
      // When
      const due = sweepMinutesWhenDue(timezone, date, time);

      // Then
      expect(due).toEqual(expected);
    },
  );

  it.each([
    {
      timezone: "America/New_York",
      date: "2027-11-07",
      expected: ["01:30-04:00", "01:31-04:00", "01:32-04:00"],
    },
    {
      timezone: "Europe/London",
      date: "2027-10-31",
      expected: ["01:30+01:00", "01:31+01:00", "01:32+01:00"],
    },
  ])(
    "$timezone 가을 DST로 두 번 오는 시각은 앞의 것에만 울린다($date)",
    ({ timezone, date, expected }) => {
      // When
      const due = sweepMinutesWhenDue(timezone, date, { hour: 1, minute: 30 });

      // Then
      expect(due).toEqual(expected);
    },
  );

  it("틈 뒤 첫 분은 틈 안의 시각을 모두 함께 울리고 묶음도 따로 둔다", () => {
    // Given
    // 뉴욕은 07:00Z에 02:00이 03:00으로 넘어가고, 같은 03:00인 토론토도 같은 규칙이다
    const minute = Temporal.Instant.from("2027-03-14T07:00:00Z");

    // When
    const due = reminderTimesDueAt(minute, "America/New_York");
    const groups = groupTimezonesByLocalClock(minute, [
      "America/New_York",
      "America/Toronto",
      "America/Puerto_Rico",
    ]);

    // Then
    // grace 안의 01:58·01:59, 틈 안의 02:00~02:59, 지금인 03:00이다
    expect(due).toHaveLength(63);
    expect(due.at(0)).toEqual({ hour: 1, minute: 58 });
    expect(due).toContainEqual({ hour: 2, minute: 30 });
    expect(due.at(-1)).toEqual({ hour: 3, minute: 0 });
    expect(groups.map(({ timezones }) => timezones)).toEqual([
      ["America/New_York", "America/Toronto"],
      ["America/Puerto_Rico"],
    ]);
  });
});
