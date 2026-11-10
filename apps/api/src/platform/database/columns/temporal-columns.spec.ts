import { is } from "drizzle-orm";
import { PgCustomColumn, pgTable } from "drizzle-orm/pg-core";

import { instant, plainDate } from "./temporal-columns.js";

const sample = pgTable("TemporalSample", {
  occurredAt: instant(),
  confirmedAt: instant({ withTimezone: true }),
  dueDate: plainDate(),
});

describe("Temporal column — DB 타입과 값 변환", () => {
  it("기존 컬럼과 같은 SQL 타입을 낸다", () => {
    // Given
    const columns = [sample.occurredAt, sample.confirmedAt, sample.dueDate];

    // When
    const sqlTypes = columns.map((column) => column.getSQLType());

    // Then
    expect(sqlTypes).toEqual(["timestamp(3)", "timestamp(3) with time zone", "date"]);
  });

  it.each([
    { label: "timestamp 텍스트는 UTC 벽시계로 읽는다", text: "2026-11-10 09:30:15.007" },
    { label: "timestamptz 텍스트는 오프셋으로 읽는다", text: "2026-11-10 18:30:15.007+09" },
    { label: "RQB JSON의 timestamp는 T 구분자로 온다", text: "2026-11-10T09:30:15.007" },
    {
      label: "RQB JSON의 timestamptz는 콜론 오프셋으로 온다",
      text: "2026-11-10T09:30:15.007+00:00",
    },
  ])("$label", ({ text }) => {
    // Given
    const expected = Temporal.Instant.from("2026-11-10T09:30:15.007Z");

    // When
    const fromDriver = sample.occurredAt.mapFromDriverValue(text);
    const fromJson = is(sample.occurredAt, PgCustomColumn)
      ? sample.occurredAt.mapFromJsonValue?.(text)
      : null;

    // Then
    expect(fromDriver.equals(expected)).toBe(true);
    expect(fromJson instanceof Temporal.Instant && fromJson.equals(expected)).toBe(true);
  });

  it("순간은 ms 3자리 ISO 문자열로 보낸다", () => {
    // Given
    const value = Temporal.Instant.from("2026-11-10T09:30:15.007891Z");

    // When
    const driverValue = sample.confirmedAt.mapToDriverValue(value);

    // Then
    expect(driverValue).toBe("2026-11-10T09:30:15.007Z");
  });

  it("달력 날짜는 시간대 해석 없이 YYYY-MM-DD로 오간다", () => {
    // Given
    const text = "2026-02-28";

    // When
    const date = sample.dueDate.mapFromDriverValue(text);

    // Then
    expect(date.equals(new Temporal.PlainDate(2026, 2, 28))).toBe(true);
    expect(sample.dueDate.mapToDriverValue(date)).toBe(text);
  });
});
