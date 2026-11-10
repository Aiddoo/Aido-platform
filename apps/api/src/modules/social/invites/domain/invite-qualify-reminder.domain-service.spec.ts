import { TimeZone } from "#api/shared/domain/time/time-zone.vo";

import {
  deliveryTimeZoneOf,
  hasOneActiveDayLeft,
  nextQualifyReminderAt,
  qualifyReminderExpiresBefore,
} from "./invite-qualify-reminder.domain-service.js";

describe("nextQualifyReminderAt — 사용 시작 알림 발송 시각", () => {
  it.each([
    {
      label: "서울 새벽 정비 실행은 그날 18시",
      now: "2028-03-01T18:30:00.000Z",
      timezone: "Asia/Seoul",
      expected: "2028-03-02T09:00:00.000Z",
    },
    {
      label: "서울 18시가 지났으면 다음 날 18시",
      now: "2028-03-02T09:00:00.000Z",
      timezone: "Asia/Seoul",
      expected: "2028-03-03T09:00:00.000Z",
    },
    {
      label: "UTC로 고정된 시간대는 배송 기준대로 KST",
      now: "2028-03-01T18:30:00.000Z",
      timezone: "UTC",
      expected: "2028-03-02T09:00:00.000Z",
    },
    {
      label: "알 수 없는 시간대도 배송 기준대로 KST",
      now: "2028-03-01T18:30:00.000Z",
      timezone: "Mars/Base",
      expected: "2028-03-02T09:00:00.000Z",
    },
    {
      label: "LA 서머타임 시작일에도 벽시계 18시",
      now: "2028-03-12T09:00:00.000Z",
      timezone: "America/Los_Angeles",
      expected: "2028-03-13T01:00:00.000Z",
    },
  ])("$label", ({ now, timezone, expected }) => {
    // When
    const sendAt = nextQualifyReminderAt({
      now: Temporal.Instant.from(now),
      timeZone: TimeZone.reconstitute(timezone),
    });

    // Then
    expect(sendAt.toString({ fractionalSecondDigits: 3 })).toBe(expected);
  });
});

describe("invite-qualify-reminder — 알림 후보 기준", () => {
  it("저장 기본값 UTC와 모르는 시간대만 KST로 보고 실제 시간대는 그대로 둔다", () => {
    // Given
    const timeZones = ["UTC", "Mars/Base", "America/Los_Angeles"].map((raw) =>
      TimeZone.reconstitute(raw),
    );

    // When
    const resolved = timeZones.map((timeZone) => deliveryTimeZoneOf(timeZone).value);

    // Then
    expect(resolved).toEqual(["Asia/Seoul", "Asia/Seoul", "America/Los_Angeles"]);
  });

  it("마감 3×24시간 안으로 들어온 수락이 후보다", () => {
    // Given
    const now = Temporal.Instant.from("2028-03-02T03:00:00Z");

    // When
    const expiresBefore = qualifyReminderExpiresBefore(now);

    // Then
    expect(expiresBefore.toString()).toBe("2028-03-05T03:00:00Z");
  });

  it.each([
    { count: 0, expected: false },
    { count: 1, expected: true },
    { count: 2, expected: false },
  ])("활동일 $count일이면 하루만 남았는지는 $expected다", ({ count, expected }) => {
    // When
    const result = hasOneActiveDayLeft(count);

    // Then
    expect(result).toBe(expected);
  });
});
