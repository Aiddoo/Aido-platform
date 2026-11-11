import { TimeZone } from "#api/shared/domain/time/time-zone.vo";

import {
  hasEnoughActiveDays,
  localActivityDate,
  qualificationExpiresAt,
} from "./invite-qualification.domain-service.js";

const LOS_ANGELES = TimeZone.create("America/Los_Angeles");

describe("invite-qualification — 사용 시작 판정", () => {
  it.each([
    // 같은 UTC 시각이 서울과 로스앤젤레스에서 서로 다른 윤년 날짜가 된다
    { at: "2028-02-28T15:00:00.000Z", seoul: "2028-02-29", losAngeles: "2028-02-28" },
    { at: "2028-02-29T14:59:59.999Z", seoul: "2028-02-29", losAngeles: "2028-02-29" },
    { at: "2028-02-29T15:00:00.000Z", seoul: "2028-03-01", losAngeles: "2028-02-29" },
    { at: "2028-03-01T07:59:59.999Z", seoul: "2028-03-01", losAngeles: "2028-02-29" },
    { at: "2028-03-01T08:00:00.000Z", seoul: "2028-03-01", losAngeles: "2028-03-01" },
  ])("$at의 활동일은 서울 $seoul, 로스앤젤레스 $losAngeles다", ({ at, seoul, losAngeles }) => {
    // Given
    const occurredAt = Temporal.Instant.from(at);

    // When
    const days = [
      localActivityDate(occurredAt, TimeZone.SEOUL).toString(),
      localActivityDate(occurredAt, LOS_ANGELES).toString(),
    ];

    // Then
    expect(days).toEqual([seoul, losAngeles]);
  });

  it.each(["Mars/Base", "", "KST"])("저장된 시간대 %j를 알 수 없으면 UTC 날짜로 센다", (raw) => {
    // Given
    const occurredAt = Temporal.Instant.from("2028-02-28T15:00:00Z");

    // When
    const day = localActivityDate(occurredAt, TimeZone.reconstitute(raw));

    // Then
    expect(day.toString()).toBe("2028-02-28");
  });

  it.each([
    { count: 1, expected: false },
    { count: 2, expected: true },
  ])("서로 다른 날짜 $count일이면 사용 시작 여부는 $expected다", ({ count, expected }) => {
    // When
    const result = hasEnoughActiveDays(count);

    // Then
    expect(result).toBe(expected);
  });

  it("마감은 수락 순간에서 14×24시간 뒤라 서머타임 날짜에도 시각이 밀리지 않는다", () => {
    // Given 미국 서머타임 시작(2028-03-12)을 지나는 수락
    const joinedAt = Temporal.Instant.from("2028-03-01T03:00:00Z");

    // When
    const expiresAt = qualificationExpiresAt(joinedAt);

    // Then
    expect(expiresAt.toString()).toBe("2028-03-15T03:00:00Z");
  });
});
