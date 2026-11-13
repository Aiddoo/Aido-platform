import { readFileSync } from "node:fs";

import { z } from "zod";

import { formatIsoWeekLabel, getIsoWeekOfMonth } from "./week-of-month.js";

/** 앱 getCalendarWeek·getIsoWeekOfMonth·formatIsoWeekLabel도 같은 표를 읽는다. 서버는 ISO 주만 쓴다 */
const SHARED_WEEK_CASES = z
  .object({
    weekOfMonth: z.array(
      z.object({
        name: z.string(),
        system: z.enum(["SUNDAY_START", "ISO"]),
        date: z.iso.date(),
        expectedMiddleDate: z.iso.date(),
        expectedWeekOfMonth: z.int().min(1).max(5),
      }),
    ),
    isoWeekLabel: z.array(
      z.object({
        name: z.string(),
        date: z.iso.date(),
        today: z.iso.date(),
        ko: z.string(),
        en: z.string(),
      }),
    ),
  })
  .parse(
    JSON.parse(
      readFileSync(
        new URL(
          "../../../../../../packages/api/test/fixtures/week-of-month-cases.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  );

describe("getIsoWeekOfMonth — 주차는 주의 목요일이 속한 달의 몇째 주다", () => {
  it.each(SHARED_WEEK_CASES.weekOfMonth.filter((row) => row.system === "ISO"))(
    "앱과 같은 주차 표: $name",
    ({ date, expectedMiddleDate, expectedWeekOfMonth }) => {
      // When
      const { middleDate, weekOfMonth } = getIsoWeekOfMonth(Temporal.PlainDate.from(date));

      // Then
      expect(middleDate.toString()).toBe(expectedMiddleDate);
      expect(weekOfMonth).toBe(expectedWeekOfMonth);
    },
  );
});

describe("formatIsoWeekLabel — 주차 달의 해가 올해가 아니면 연도를 붙인다", () => {
  it.each(SHARED_WEEK_CASES.isoWeekLabel)("앱과 같은 라벨 표: $name", ({ date, today, ko, en }) => {
    // Given
    const week = Temporal.PlainDate.from(date);
    const localToday = Temporal.PlainDate.from(today);

    // When
    const korean = formatIsoWeekLabel(week, "ko", localToday);
    const english = formatIsoWeekLabel(week, "en", localToday);

    // Then
    expect([korean, english]).toEqual([ko, en]);
  });
});
