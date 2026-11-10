import { ErrorCode } from "@aido/api/errors";
import { TODO_ITEM_LIMITS } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { addDaysToKey } from "../../shared/domain/todo-calendar.domain-service.js";
import { TodoTitle } from "../../shared/domain/todo-title.vo.js";
import { RepeatRule } from "./repeat-rule.vo.js";
import { TodoSeriesId } from "./todo-series-id.vo.js";
import { type ChecklistTemplateItem, TodoSeries } from "./todo-series.aggregate.js";

const AT = Temporal.Instant.from("2026-11-05T01:00:00.000Z");

interface StartOverrides {
  readonly rule?: RepeatRule;
  readonly startDate?: string;
  readonly timezone?: string;
  readonly scheduledLocalTime?: string | null;
  readonly checklistTemplate?: readonly ChecklistTemplateItem[];
  readonly now?: Temporal.Instant;
}

function start(overrides: StartOverrides = {}): TodoSeries {
  return TodoSeries.create({
    id: TodoSeriesId.reconstitute("series-1"),
    userId: UserId.reconstitute("user-1"),
    categoryId: 1,
    title: TodoTitle.create("물 마시기"),
    visibility: "PUBLIC",
    scheduledLocalTime: overrides.scheduledLocalTime ?? null,
    timezone: overrides.timezone ?? "Asia/Seoul",
    rule: overrides.rule ?? RepeatRule.create({ frequency: "DAILY", end: { type: "NEVER" } }),
    startDate: overrides.startDate ?? "2026-11-05",
    checklistTemplate: overrides.checklistTemplate ?? [],
    now: overrides.now ?? AT,
  });
}

describe("TodoSeries — 반복 할 일", () => {
  describe("시작", () => {
    it("다음 회차를 첫 날짜로 잡고 만든 회차 수는 0이다", () => {
      // Given
      const rule = RepeatRule.create({
        frequency: "WEEKLY",
        weekdays: ["FRI"],
        interval: 1,
        end: { type: "NEVER" },
      });
      // When
      const series = start({ rule });
      // Then
      expect(series.nextOccurrenceDate).toBe("2026-11-06");
      expect(series.generatedCount).toBe(0);
    });

    it("만들 수 있는 날짜가 없으면 TODO_0843이고 입력을 상세에 담는다", () => {
      // Given
      const rule = RepeatRule.create({
        frequency: "DAILY",
        end: { type: "UNTIL", date: "2026-11-04" },
      });
      // When / Then
      expect(() => start({ rule })).toThrow(
        expect.objectContaining({
          errorCode: ErrorCode.TODO_0843,
          details: { startDate: "2026-11-05", repeat: rule.toSpec() },
        }),
      );
    });

    it("체크리스트 상한을 넘으면 TODO_0821이다", () => {
      // Given
      const checklistTemplate = Array.from({ length: TODO_ITEM_LIMITS.MAX_PER_TODO + 1 }, () => ({
        title: "항목",
      }));
      // When / Then
      expect(() => start({ checklistTemplate })).toThrow(
        expect.objectContaining({ errorCode: ErrorCode.TODO_0821 }),
      );
    });
  });

  describe("회차 채우기", () => {
    it("커서부터 through까지 만들고 다음 회차·개수를 옮긴다", () => {
      // Given
      const series = start();
      // When
      const first = series.planOccurrences("2026-11-07");
      const second = series.planOccurrences("2026-11-08");
      // Then
      expect(first.map((draft) => draft.occurrenceDate)).toEqual([
        "2026-11-05",
        "2026-11-06",
        "2026-11-07",
      ]);
      expect(second.map((draft) => draft.occurrenceDate)).toEqual(["2026-11-08"]);
      expect(series.nextOccurrenceDate).toBe("2026-11-09");
      expect(series.generatedCount).toBe(4);
    });

    it("횟수를 다 채우면 다음 회차가 null이 되고 더 만들지 않는다", () => {
      // Given
      const series = start({
        rule: RepeatRule.create({ frequency: "DAILY", end: { type: "COUNT", count: 2 } }),
      });
      // When
      const drafts = series.planOccurrences("2026-12-31");
      // Then
      expect(drafts).toHaveLength(2);
      expect(series.nextOccurrenceDate).toBeNull();
      expect(series.isActive).toBe(false);
      expect(series.planOccurrences("2027-12-31")).toEqual([]);
    });

    it("기간 안에 회차가 없으면 커서를 그대로 둔다", () => {
      // Given
      const series = start({
        rule: RepeatRule.create({ frequency: "MONTHLY", monthDay: 31, end: { type: "NEVER" } }),
      });
      // When
      const drafts = series.planOccurrences("2026-11-20");
      // Then
      expect(drafts).toEqual([]);
      expect(series.nextOccurrenceDate).toBe("2026-11-30");
    });

    it("회차는 규칙의 createdAt을 물려받고 종일이면 시간이 없다", () => {
      // Given
      const series = start();
      // When
      const [draft] = series.planOccurrences("2026-11-05");
      // Then
      expect(draft).toMatchObject({
        createdAt: AT,
        scheduledTime: null,
        isAllDay: true,
        endDate: null,
      });
    });

    it.each([
      {
        name: "봄 전환 전날은 EST",
        date: "2027-03-13",
        time: "02:30",
        expected: "2027-03-13T07:30:00.000Z",
      },
      {
        name: "봄에 없는 시각은 앞으로 민다",
        date: "2027-03-14",
        time: "02:30",
        expected: "2027-03-14T07:30:00.000Z",
      },
      {
        name: "봄 전환 다음 날은 EDT",
        date: "2027-03-15",
        time: "02:30",
        expected: "2027-03-15T06:30:00.000Z",
      },
      {
        name: "가을에 겹치는 시각은 RFC 5545대로 앞쪽 EDT",
        date: "2027-11-07",
        time: "01:30",
        expected: "2027-11-07T05:30:00.000Z",
      },
    ])("뉴욕 DST: $name", ({ date, time, expected }) => {
      // Given
      const series = start({
        rule: RepeatRule.create({ frequency: "DAILY", end: { type: "NEVER" } }),
        startDate: date,
        scheduledLocalTime: time,
        timezone: "America/New_York",
      });
      // When
      const [draft] = series.planOccurrences(date);
      // Then
      expect(draft?.scheduledTime).toEqual(Temporal.Instant.from(expected));
      expect(draft?.isAllDay).toBe(false);
    });
  });

  describe("반복 끝내기", () => {
    it("다음 회차를 지우고 한 번만 끝난다", () => {
      // Given
      const series = start();
      // When
      const first = series.stopAfter("2026-11-10");
      const second = series.stopAfter("2026-11-10");
      // Then
      expect(first).toBe(true);
      expect(second).toBe(false);
      expect(series.nextOccurrenceDate).toBeNull();
      expect(series.rule.toSpec().end).toEqual({ type: "UNTIL", date: "2026-11-10" });
    });

    it("모두 만들었어도 뒤에 회차가 남았으면 끝낼 수 있다", () => {
      // Given
      const series = start({
        rule: RepeatRule.create({ frequency: "DAILY", end: { type: "COUNT", count: 5 } }),
      });
      series.planOccurrences("2026-12-31");
      // When
      const stopped = series.stopAfter("2026-11-06");
      // Then
      expect(stopped).toBe(true);
    });

    it.each([
      {
        name: "매일 계속",
        rule: RepeatRule.create({ frequency: "DAILY", end: { type: "NEVER" } }),
      },
      {
        name: "횟수 종료",
        rule: RepeatRule.create({ frequency: "DAILY", end: { type: "COUNT", count: 5 } }),
      },
      {
        name: "날짜 종료",
        rule: RepeatRule.create({ frequency: "DAILY", end: { type: "UNTIL", date: "2026-12-31" } }),
      },
    ])(
      "$name: 첫 회차 앞에서 끝내도 종료일이 시작일보다 앞서지 않고 두 번째는 false다",
      ({ rule }) => {
        // Given
        const series = start({ rule });
        const dayBeforeStart = addDaysToKey(series.startDate, -1);
        // When
        const first = series.stopAfter(dayBeforeStart);
        const second = series.stopAfter(dayBeforeStart);
        // Then
        expect(first).toBe(true);
        expect(second).toBe(false);
        expect(series.rule.toSpec().end).toEqual({
          type: "UNTIL",
          date: series.startDate,
        });
        expect(series.nextOccurrenceDate).toBeNull();
      },
    );

    it("마지막 회차 뒤에서는 끝낼 게 없다", () => {
      // Given
      const series = start({
        rule: RepeatRule.create({ frequency: "DAILY", end: { type: "COUNT", count: 2 } }),
      });
      series.planOccurrences("2026-12-31");
      // When
      const stopped = series.stopAfter("2026-11-06");
      // Then
      expect(stopped).toBe(false);
    });
  });

  describe("반복 끝내기 — 뒤처진 커서", () => {
    it("규칙이 이미 끝났어도 커서가 남아 있으면 닫는다", () => {
      // Given
      const series = TodoSeries.reconstitute({
        ...start({
          rule: RepeatRule.create({
            frequency: "DAILY",
            end: { type: "UNTIL", date: "2026-11-10" },
          }),
        }).toPrimitives(),
        nextOccurrenceDate: "2026-11-08",
      });
      // When
      const stopped = series.stopAfter("2026-11-12");
      // Then
      expect(stopped).toBe(true);
      expect(series.nextOccurrenceDate).toBeNull();
      expect(series.rule.toSpec().end).toEqual({ type: "UNTIL", date: "2026-11-10" });
    });
  });

  describe("지난 시작일 상한", () => {
    const AT_NOW = Temporal.Instant.from("2026-11-05T00:00:00.000Z");

    it.each([
      {
        name: "매일 1년 안",
        startDate: "2025-11-05",
        rule: RepeatRule.create({ frequency: "DAILY", end: { type: "NEVER" } }),
      },
      {
        name: "매주는 2년 전이어도 회차가 적다",
        startDate: "2024-11-04",
        rule: RepeatRule.create({
          frequency: "WEEKLY",
          weekdays: ["MON"],
          interval: 1,
          end: { type: "NEVER" },
        }),
      },
      {
        name: "날짜까지 끝나는 366일 범위",
        startDate: "2000-01-03",
        rule: RepeatRule.create({ frequency: "DAILY", end: { type: "UNTIL", date: "2000-12-31" } }),
      },
    ])("$name 은 받는다", ({ startDate, rule }) => {
      // Given
      const series = start({ startDate, rule, timezone: "UTC" });
      // When
      const check = () => series.assertWithinPastLimit(AT_NOW);
      // Then
      expect(check).not.toThrow();
    });

    it("매일 2년 전 시작은 TODO_0845다", () => {
      // Given
      const series = start({
        startDate: "2024-11-05",
        rule: RepeatRule.create({ frequency: "DAILY", end: { type: "NEVER" } }),
        timezone: "UTC",
      });
      // When
      const check = () => series.assertWithinPastLimit(AT_NOW);
      // Then
      expect(check).toThrowError(
        expect.objectContaining({
          errorCode: ErrorCode.TODO_0845,
          details: { field: "startDate" },
        }),
      );
    });
  });

  describe("분할", () => {
    it("두 번 나눠도 원본 규칙 id를 물려받는다", () => {
      // Given
      const series = start();
      expect(series.originSeriesId.value).toBe("series-1");
      // When
      const second = series.splitFrom({
        pivotDate: "2026-11-08",
        changes: { title: "둘째" },
        id: TodoSeriesId.reconstitute("series-2"),
        now: AT,
      });
      const third = second.splitFrom({
        pivotDate: "2026-11-10",
        changes: { title: "셋째" },
        id: TodoSeriesId.reconstitute("series-3"),
        now: AT,
      });
      // Then
      expect(second.originSeriesId.value).toBe("series-1");
      expect(third.originSeriesId.value).toBe("series-1");
    });

    it("앞쪽은 전날로 끝나고 뒤쪽은 남은 횟수를 이어받는다", () => {
      // Given
      const series = start({
        rule: RepeatRule.create({ frequency: "DAILY", end: { type: "COUNT", count: 10 } }),
      });
      series.planOccurrences("2026-11-10");
      // When
      const next = series.splitFrom({
        pivotDate: "2026-11-08",
        changes: { title: "새 제목" },
        id: TodoSeriesId.reconstitute("series-2"),
        now: AT,
      });
      // Then
      expect(series.rule.toSpec().end).toEqual({ type: "UNTIL", date: "2026-11-07" });
      expect(series.isActive).toBe(false);
      expect(next.id.value).toBe("series-2");
      expect(next.title.value).toBe("새 제목");
      expect(next.startDate).toBe("2026-11-08");
      expect(next.rule.toSpec().end).toEqual({ type: "COUNT", count: 7 });
      expect(next.nextOccurrenceDate).toBe("2026-11-08");
    });

    it("규칙을 새로 주면 그 규칙으로 잇는다", () => {
      // Given
      const series = start();
      const rule = RepeatRule.create({
        frequency: "WEEKLY",
        weekdays: ["MON"],
        interval: 1,
        end: { type: "NEVER" },
      });
      // When
      const next = series.splitFrom({
        pivotDate: "2026-11-08",
        changes: { rule },
        id: TodoSeriesId.reconstitute("series-2"),
        now: AT,
      });
      // Then
      expect(next.rule.equals(rule)).toBe(true);
      expect(next.nextOccurrenceDate).toBe("2026-11-09");
    });
  });

  describe("규칙·체크리스트 교체", () => {
    it("규칙을 바꾸면 처음부터 다시 세고 같은 규칙이면 false다", () => {
      // Given
      const series = start();
      series.planOccurrences("2026-11-10");
      const rule = RepeatRule.create({
        frequency: "WEEKLY",
        weekdays: ["FRI"],
        interval: 1,
        end: { type: "NEVER" },
      });
      // When
      const changed = series.replaceRule(rule);
      const same = series.replaceRule(
        RepeatRule.create({
          frequency: "WEEKLY",
          weekdays: ["FRI"],
          interval: 1,
          end: { type: "NEVER" },
        }),
      );
      // Then
      expect(changed).toBe(true);
      expect(same).toBe(false);
      expect(series.generatedCount).toBe(0);
      expect(series.nextOccurrenceDate).toBe("2026-11-06");
    });

    it("맞는 날짜가 없는 규칙으로는 바꿀 수 없다", () => {
      // Given
      const series = start();
      // When / Then
      expect(() =>
        series.replaceRule(
          RepeatRule.create({ frequency: "DAILY", end: { type: "UNTIL", date: "2026-11-01" } }),
        ),
      ).toThrow(expect.objectContaining({ errorCode: ErrorCode.TODO_0843 }));
      expect(series.nextOccurrenceDate).toBe("2026-11-05");
    });

    it("체크리스트는 같으면 false이고 상한을 넘으면 거부한다", () => {
      // Given
      const series = start({ checklistTemplate: [{ title: "항목" }] });
      // When / Then
      expect(series.replaceChecklist([{ title: "항목" }])).toBe(false);
      expect(series.replaceChecklist([{ title: "새 항목" }])).toBe(true);
      expect(() =>
        series.replaceChecklist(
          Array.from({ length: TODO_ITEM_LIMITS.MAX_PER_TODO + 1 }, () => ({ title: "x" })),
        ),
      ).toThrow(expect.objectContaining({ errorCode: ErrorCode.TODO_0821 }));
    });
  });

  describe("제자리 수정", () => {
    it("같은 값이면 false, 바뀌면 true를 돌려준다", () => {
      // Given
      const series = start();
      // When
      const same = series.applyDetails({ title: "물 마시기", categoryId: 1 });
      const changed = series.applyDetails({ visibility: "PRIVATE", scheduledLocalTime: "09:00" });
      // Then
      expect(same).toBe(false);
      expect(changed).toBe(true);
      expect(series.visibility).toBe("PRIVATE");
      expect(series.scheduledLocalTime).toBe("09:00");
    });

    it("null은 시간 지우기이고 undefined는 유지다", () => {
      // Given
      const series = start({ scheduledLocalTime: "09:00" });
      // When
      const kept = series.applyDetails({ scheduledLocalTime: undefined });
      const cleared = series.applyDetails({ scheduledLocalTime: null });
      // Then
      expect(kept).toBe(false);
      expect(cleared).toBe(true);
      expect(series.scheduledLocalTime).toBeNull();
    });
  });

  describe("자리 비운 동안 멈춘 커서", () => {
    const LAST_MOVED_AT = Temporal.Instant.from("2026-06-01T00:00:00.000Z");
    const RETURNED_AT = Temporal.Instant.from("2026-11-05T03:00:00.000Z");

    /** 6월 1일에 마지막으로 채워 커서가 멈춘 규칙 */
    function stale(rule: RepeatRule, nextOccurrenceDate: string, generatedCount = 0): TodoSeries {
      return TodoSeries.reconstitute({
        ...start({
          rule,
          startDate: "2026-03-01",
          timezone: "UTC",
          now: LAST_MOVED_AT,
        }).toPrimitives(),
        nextOccurrenceDate,
        generatedCount,
      });
    }

    it("오늘 이후 첫 회차로 옮기고 지난 날은 만들지 않는다", () => {
      // Given
      const series = stale(
        RepeatRule.create({ frequency: "DAILY", end: { type: "NEVER" } }),
        "2026-08-30",
        182,
      );
      // When
      const skipped = series.skipDormantGap(RETURNED_AT);
      const drafts = series.planOccurrences("2027-02-03");
      // Then
      expect(skipped).toBe(true);
      expect(drafts.at(0)?.occurrenceDate).toBe("2026-11-05");
      expect(drafts).toHaveLength(91);
      expect(series.nextOccurrenceDate).toBe("2027-02-04");
    });

    it("다시 불러도 바뀌지 않는다", () => {
      // Given
      const series = stale(
        RepeatRule.create({ frequency: "DAILY", end: { type: "NEVER" } }),
        "2026-08-30",
      );
      series.skipDormantGap(RETURNED_AT);
      // When
      const again = series.skipDormantGap(RETURNED_AT);
      // Then
      expect(again).toBe(false);
      expect(series.nextOccurrenceDate).toBe("2026-11-05");
    });

    it("커서가 오늘이면 옮길 것이 없다", () => {
      // Given
      const series = stale(
        RepeatRule.create({ frequency: "DAILY", end: { type: "NEVER" } }),
        "2026-11-05",
      );
      // When
      const skipped = series.skipDormantGap(RETURNED_AT);
      // Then
      expect(skipped).toBe(false);
      expect(series.nextOccurrenceDate).toBe("2026-11-05");
    });

    it("규칙을 방금 고쳐 updatedAt이 최근이어도 뒤처진 커서면 지난 날을 건너뛴다", () => {
      // Given
      const series = TodoSeries.reconstitute({
        ...stale(
          RepeatRule.create({ frequency: "DAILY", end: { type: "NEVER" } }),
          "2026-08-30",
        ).toPrimitives(),
        updatedAt: RETURNED_AT,
      });
      // When
      const skipped = series.skipDormantGap(RETURNED_AT);
      // Then
      expect(skipped).toBe(true);
      expect(series.nextOccurrenceDate).toBe("2026-11-05");
    });

    it("규칙 시간대의 오늘로 잰다", () => {
      // Given
      const seoul = TodoSeries.reconstitute({
        ...stale(
          RepeatRule.create({ frequency: "DAILY", end: { type: "NEVER" } }),
          "2026-08-30",
        ).toPrimitives(),
        timezone: "Asia/Seoul",
      });
      const newYork = TodoSeries.reconstitute({
        ...stale(
          RepeatRule.create({ frequency: "DAILY", end: { type: "NEVER" } }),
          "2026-08-30",
        ).toPrimitives(),
        timezone: "America/New_York",
      });
      const at = Temporal.Instant.from("2026-11-05T16:00:00.000Z");
      // When
      seoul.skipDormantGap(at);
      newYork.skipDormantGap(at);
      // Then
      expect(seoul.nextOccurrenceDate).toBe("2026-11-06");
      expect(newYork.nextOccurrenceDate).toBe("2026-11-05");
    });

    it("UNTIL이 지났으면 끝난 규칙이고 새 규칙을 만들지 않는다", () => {
      // Given
      const series = stale(
        RepeatRule.create({ frequency: "DAILY", end: { type: "UNTIL", date: "2026-10-01" } }),
        "2026-08-30",
      );
      // When
      const skipped = series.skipDormantGap(RETURNED_AT);
      // Then
      expect(skipped).toBe(true);
      expect(series.nextOccurrenceDate).toBeNull();
      expect(series.isActive).toBe(false);
      expect(series.planOccurrences("2027-02-03")).toEqual([]);
    });

    it("UNTIL이 오늘이면 오늘 회차 하나만 남는다", () => {
      // Given
      const series = stale(
        RepeatRule.create({ frequency: "DAILY", end: { type: "UNTIL", date: "2026-11-05" } }),
        "2026-08-30",
      );
      // When
      series.skipDormantGap(RETURNED_AT);
      const drafts = series.planOccurrences("2027-02-03");
      // Then
      expect(drafts.map((draft) => draft.occurrenceDate)).toEqual(["2026-11-05"]);
      expect(series.nextOccurrenceDate).toBeNull();
    });

    it("COUNT는 달력으로 세어 그 횟수의 날짜가 다 지났으면 끝난다", () => {
      // Given
      const series = stale(
        RepeatRule.create({ frequency: "DAILY", end: { type: "COUNT", count: 100 } }),
        "2026-05-20",
        80,
      );
      // When
      series.skipDormantGap(RETURNED_AT);
      // Then
      expect(series.nextOccurrenceDate).toBeNull();
      expect(series.generatedCount).toBe(100);
    });

    it("COUNT가 남았으면 지난 날짜를 횟수에 넣고 남은 만큼만 만든다", () => {
      // Given
      const series = stale(
        RepeatRule.create({ frequency: "DAILY", end: { type: "COUNT", count: 250 } }),
        "2026-05-20",
        80,
      );
      // When
      series.skipDormantGap(RETURNED_AT);
      const drafts = series.planOccurrences("2027-02-03");
      // Then
      expect(series.generatedCount).toBe(250);
      expect(drafts.at(0)?.occurrenceDate).toBe("2026-11-05");
      expect(drafts).toHaveLength(250 - 249);
    });

    it("격주는 시작 주를 기준으로 그대로 이어진다", () => {
      // Given
      const rule = RepeatRule.create({
        frequency: "WEEKLY",
        weekdays: ["MON"],
        interval: 2,
        end: { type: "NEVER" },
      });
      const series = TodoSeries.reconstitute({
        ...start({
          rule,
          startDate: "2026-03-02",
          timezone: "UTC",
          now: LAST_MOVED_AT,
        }).toPrimitives(),
        nextOccurrenceDate: "2026-08-17",
      });
      // When
      series.skipDormantGap(RETURNED_AT);
      // Then
      expect(series.nextOccurrenceDate).toBe("2026-11-09");
    });

    it("매월 31일은 짧은 달의 말일로 이어진다", () => {
      // Given
      const rule = RepeatRule.create({
        frequency: "MONTHLY",
        monthDay: 31,
        end: { type: "NEVER" },
      });
      const series = stale(rule, "2026-08-31");
      // When
      series.skipDormantGap(RETURNED_AT);
      // Then
      expect(series.nextOccurrenceDate).toBe("2026-11-30");
    });
  });
});
