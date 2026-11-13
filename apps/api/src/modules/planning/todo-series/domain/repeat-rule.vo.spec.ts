import { readFileSync } from "node:fs";

import { todoRepeatSchema } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { z } from "zod";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

import { RepeatRule, type RepeatEnd, type RepeatSpec } from "./repeat-rule.vo.js";

const NEVER: RepeatEnd = { type: "NEVER" };

/** 앱 TodoRepeatPolicy도 같은 표를 읽는다. 두 구현이 어긋나면 어느 한쪽 테스트가 깨진다. */
const SHARED_OCCURRENCE_CASES = z
  .array(
    z.object({
      name: z.string(),
      startDate: z.iso.date(),
      repeat: todoRepeatSchema,
      through: z.iso.date(),
      expected: z.array(z.iso.date()),
    }),
  )
  .parse(
    JSON.parse(
      readFileSync(
        new URL(
          "../../../../../../../packages/api/test/fixtures/repeat-occurrence-cases.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  );

/** 앱 반복 미리보기의 마지막 회차(findLastRepeatOccurrenceDateKey)도 같은 표를 읽는다. 간격으로 건너뛰는 걷기를 함께 지킨다. */
const SHARED_LAST_OCCURRENCE_CASES = z
  .array(
    z.object({
      name: z.string(),
      startDate: z.iso.date(),
      repeat: todoRepeatSchema,
      expectedCount: z.int().positive(),
      expectedLast: z.iso.date(),
    }),
  )
  .parse(
    JSON.parse(
      readFileSync(
        new URL(
          "../../../../../../../packages/api/test/fixtures/repeat-last-occurrence-cases.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  );

/** 표의 어떤 규칙보다 늦은 날. 끝(횟수·날짜)이 회차를 자른다. */
const FAR_THROUGH = "2100-12-31";

describe("RepeatRule — 반복 규칙", () => {
  it.each(SHARED_OCCURRENCE_CASES)(
    "앱과 같은 회차 표: $name",
    ({ startDate, repeat, through, expected }) => {
      // Given
      const rule = RepeatRule.create(repeat);
      // When
      const occurrences = rule.occurrencesBetween(startDate, startDate, through);
      // Then
      expect(occurrences).toEqual(expected);
    },
  );

  it.each(SHARED_LAST_OCCURRENCE_CASES)(
    "앱과 같은 마지막 회차 표: $name",
    ({ startDate, repeat, expectedCount, expectedLast }) => {
      // Given
      const rule = RepeatRule.create(repeat);
      // When
      const occurrences = rule.occurrencesBetween(startDate, startDate, FAR_THROUGH);
      // Then
      expect({ count: occurrences.length, last: occurrences.at(-1) }).toEqual({
        count: expectedCount,
        last: expectedLast,
      });
    },
  );

  describe("회차 날짜 계산", () => {
    it.each<{
      name: string;
      spec: RepeatSpec;
      start: string;
      from?: string;
      through: string;
      expected: string[];
    }>([
      {
        name: "매일",
        spec: { frequency: "DAILY", end: NEVER },
        start: "2026-11-30",
        through: "2026-12-02",
        expected: ["2026-11-30", "2026-12-01", "2026-12-02"],
      },
      {
        name: "매주 시작일 요일이 고른 요일에 없으면 다음 맞는 날부터",
        spec: { frequency: "WEEKLY", interval: 1, weekdays: ["FRI", "MON"], end: NEVER },
        start: "2026-11-03",
        through: "2026-11-10",
        expected: ["2026-11-06", "2026-11-09"],
      },
      {
        name: "격주는 시작일이 속한 주(월요일 시작)가 기준",
        spec: { frequency: "WEEKLY", interval: 2, weekdays: ["MON", "WED"], end: NEVER },
        start: "2026-11-04",
        through: "2026-11-30",
        expected: ["2026-11-04", "2026-11-16", "2026-11-18", "2026-11-30"],
      },
      {
        name: "격주를 중간부터 읽어도 기준 주가 밀리지 않는다",
        spec: { frequency: "WEEKLY", interval: 2, weekdays: ["WED"], end: NEVER },
        start: "2026-11-04",
        from: "2026-11-10",
        through: "2026-12-02",
        expected: ["2026-11-18", "2026-12-02"],
      },
      {
        name: "매월 31일은 30일 달과 2월에 말일",
        spec: { frequency: "MONTHLY", monthDay: 31, end: NEVER },
        start: "2027-01-31",
        through: "2027-04-30",
        expected: ["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"],
      },
      {
        name: "매월 29일은 평년 2월 28일",
        spec: { frequency: "MONTHLY", monthDay: 29, end: NEVER },
        start: "2027-01-29",
        through: "2027-03-01",
        expected: ["2027-01-29", "2027-02-28"],
      },
      {
        name: "매월 29일은 윤년 2월 29일",
        spec: { frequency: "MONTHLY", monthDay: 29, end: NEVER },
        start: "2028-01-29",
        through: "2028-03-01",
        expected: ["2028-01-29", "2028-02-29"],
      },
      {
        name: "날짜 종료는 그 날을 포함",
        spec: { frequency: "DAILY", end: { type: "UNTIL", date: "2026-11-06" } },
        start: "2026-11-05",
        through: "2026-12-01",
        expected: ["2026-11-05", "2026-11-06"],
      },
      {
        name: "날짜 종료가 시작일이면 1회",
        spec: { frequency: "DAILY", end: { type: "UNTIL", date: "2026-11-05" } },
        start: "2026-11-05",
        through: "2026-12-01",
        expected: ["2026-11-05"],
      },
      {
        name: "날짜 종료가 시작일보다 앞이면 없음",
        spec: { frequency: "DAILY", end: { type: "UNTIL", date: "2026-11-04" } },
        start: "2026-11-05",
        through: "2026-12-01",
        expected: [],
      },
      {
        name: "횟수 종료는 그 횟수까지",
        spec: { frequency: "DAILY", end: { type: "COUNT", count: 2 } },
        start: "2026-11-05",
        through: "2026-12-01",
        expected: ["2026-11-05", "2026-11-06"],
      },
    ])("$name", ({ spec, start, from, through, expected }) => {
      // Given
      const rule = RepeatRule.create(spec);
      // When
      const dates = rule.occurrencesBetween(start, from ?? start, through);
      // Then
      expect(dates).toEqual(expected);
    });

    it("횟수 종료는 이미 만든 회차 수만큼 덜어낸다", () => {
      // Given
      const rule = RepeatRule.create({ frequency: "DAILY", end: { type: "COUNT", count: 3 } });
      // When
      const dates = rule.occurrencesBetween("2026-11-05", "2026-11-07", "2026-12-01", 2);
      // Then
      expect(dates).toEqual(["2026-11-07"]);
    });

    it("다음 회차를 찾을 때 끝난 규칙은 null이다", () => {
      // Given
      const rule = RepeatRule.create({ frequency: "DAILY", end: { type: "COUNT", count: 3 } });
      // When
      const next = rule.firstOnOrAfter("2026-11-05", "2026-11-08", 3);
      // Then
      expect(next).toBeNull();
    });

    it.each<{ spec: RepeatSpec; expected: string }>([
      {
        spec: { frequency: "WEEKLY", interval: 2, weekdays: ["MON"], end: NEVER },
        expected: "2026-11-16",
      },
      { spec: { frequency: "MONTHLY", monthDay: 31, end: NEVER }, expected: "2026-11-30" },
    ])("가장 먼 다음 회차도 찾는다 ($spec.frequency)", ({ spec, expected }) => {
      // Given
      const rule = RepeatRule.create(spec);
      // When
      const next = rule.firstOnOrAfter("2026-11-02", "2026-11-03");
      // Then
      expect(next).toBe(expected);
    });
  });

  describe("입력 검증", () => {
    it.each<{ field: string; build: () => RepeatRule }>([
      {
        field: "weekdays",
        build: () =>
          RepeatRule.create({ frequency: "WEEKLY", weekdays: [], interval: 1, end: NEVER }),
      },
      {
        field: "monthDay",
        build: () => RepeatRule.create({ frequency: "MONTHLY", monthDay: 32, end: NEVER }),
      },
      {
        field: "end.count",
        build: () => RepeatRule.create({ frequency: "DAILY", end: { type: "COUNT", count: 366 } }),
      },
      {
        field: "end.count",
        build: () => RepeatRule.create({ frequency: "DAILY", end: { type: "COUNT", count: 0 } }),
      },
    ])("$field가 맞지 않으면 TODO_0845다", ({ field, build }) => {
      // When / Then
      expect(build).toThrow(DomainException);
      expect(build).toThrow(
        expect.objectContaining({ errorCode: ErrorCode.TODO_0845, details: { field } }),
      );
    });

    it("요일은 중복을 없애고 월요일부터 순서대로 저장한다", () => {
      // When
      const rule = RepeatRule.create({
        frequency: "WEEKLY",
        weekdays: ["FRI", "MON", "FRI"],
        interval: 1,
        end: NEVER,
      });
      // Then
      expect(rule.toPrimitives().weekdays).toEqual(["MON", "FRI"]);
    });
  });

  describe("변환·동등성", () => {
    it("요일 순서가 달라도 같은 규칙이고 간격이 다르면 다른 규칙이다", () => {
      // Given
      const rule = RepeatRule.create({
        frequency: "WEEKLY",
        weekdays: ["MON", "FRI"],
        interval: 1,
        end: NEVER,
      });
      // When / Then
      expect(
        rule.equals(
          RepeatRule.create({
            frequency: "WEEKLY",
            weekdays: ["FRI", "MON"],
            interval: 1,
            end: NEVER,
          }),
        ),
      ).toBe(true);
      expect(
        rule.equals(
          RepeatRule.create({
            frequency: "WEEKLY",
            weekdays: ["MON", "FRI"],
            interval: 2,
            end: NEVER,
          }),
        ),
      ).toBe(false);
    });

    it("toSpec은 from의 역변환이다", () => {
      // Given
      const spec: RepeatSpec = {
        frequency: "WEEKLY",
        interval: 2,
        weekdays: ["TUE"],
        end: { type: "UNTIL", date: "2027-01-01" },
      };
      // When / Then
      expect(RepeatRule.create(spec).toSpec()).toEqual(spec);
    });

    it("분할 뒤 횟수 종료는 앞쪽에서 쓴 만큼 줄어든다", () => {
      // Given
      const rule = RepeatRule.create({ frequency: "DAILY", end: { type: "COUNT", count: 10 } });
      // When
      const next = rule.continuingFrom("2026-11-05", "2026-11-08");
      // Then
      expect(next.toSpec().end).toEqual({ type: "COUNT", count: 7 });
    });
  });
});

describe("RepeatRule — Temporal 달력 경계", () => {
  it("매월 31일은 짧은 달과 윤년 2월의 말일로 맞춘다", () => {
    // Given
    const rule = RepeatRule.create({ frequency: "MONTHLY", monthDay: 31, end: { type: "NEVER" } });

    // When
    const dates = rule.occurrencesBetween("2028-01-01", "2028-01-01", "2028-04-30");

    // Then
    expect(dates).toEqual(["2028-01-31", "2028-02-29", "2028-03-31", "2028-04-30"]);
  });

  it("매월 29일은 평년 2월의 말일(28일)로 맞춘다", () => {
    // Given
    const rule = RepeatRule.create({ frequency: "MONTHLY", monthDay: 29, end: { type: "NEVER" } });

    // When
    const dates = rule.occurrencesBetween("2027-01-01", "2027-02-01", "2027-03-31");

    // Then
    expect(dates).toEqual(["2027-02-28", "2027-03-29"]);
  });

  it("격주는 ISO 53주(2026-12-28 주)를 기준 주로 세고 해를 넘겨도 간격을 지킨다", () => {
    // Given
    const rule = RepeatRule.create({
      frequency: "WEEKLY",
      weekdays: ["MON"],
      interval: 2,
      end: { type: "NEVER" },
    });

    // When
    const dates = rule.occurrencesBetween("2026-12-28", "2026-12-28", "2027-01-31");

    // Then
    expect(dates).toEqual(["2026-12-28", "2027-01-11", "2027-01-25"]);
  });

  it("53주 일요일에 시작한 격주 일요일은 그 주 월요일을 기준으로 센다", () => {
    // Given
    const rule = RepeatRule.create({
      frequency: "WEEKLY",
      weekdays: ["SUN"],
      interval: 2,
      end: { type: "NEVER" },
    });

    // When
    const dates = rule.occurrencesBetween("2027-01-03", "2027-01-03", "2027-01-31");

    // Then
    expect(dates).toEqual(["2027-01-03", "2027-01-17", "2027-01-31"]);
  });

  it("횟수 종료는 이미 만든 회차를 빼고 남은 날짜만 준다", () => {
    // Given
    const rule = RepeatRule.create({ frequency: "DAILY", end: { type: "COUNT", count: 3 } });

    // When
    const dates = rule.occurrencesBetween("2026-12-30", "2027-01-01", "2027-01-10", 1);

    // Then
    expect(dates).toEqual(["2027-01-01", "2027-01-02"]);
  });
});
