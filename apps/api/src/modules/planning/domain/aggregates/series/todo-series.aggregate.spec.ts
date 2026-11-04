import { ErrorCode } from "@aido/api/errors";
import { TODO_ITEM_LIMITS } from "@aido/api/vocabulary";

import {
  TodoSeriesEndedEvent,
  TodoSeriesStartedEvent,
} from "../../events/series/todo-series.events.js";
import { RepeatRule } from "../../value-objects/series/repeat-rule.vo.js";
import { TodoSeries, type TodoSeriesStartInput } from "./todo-series.aggregate.js";

const AT = new Date("2026-11-05T01:00:00.000Z");

function start(overrides: Partial<TodoSeriesStartInput> = {}): TodoSeries {
  return TodoSeries.planCreation({
    id: "series-1",
    userId: "user-1",
    categoryId: 1,
    title: "물 마시기",
    visibility: "PUBLIC",
    scheduledLocalTime: null,
    timezone: "Asia/Seoul",
    rule: RepeatRule.daily({ type: "NEVER" }),
    startDate: "2026-11-05",
    checklistTemplate: [],
    sortOrder: 0,
    at: AT,
    ...overrides,
  });
}

describe("TodoSeries — 반복 할 일", () => {
  describe("시작", () => {
    it("다음 회차를 첫 날짜로 잡고 시작 이벤트를 남긴다", () => {
      // Given
      const rule = RepeatRule.weekly(["FRI"], 1, { type: "NEVER" });
      // When
      const series = start({ rule });
      // Then
      expect(series.getNextOccurrenceDate()).toBe("2026-11-06");
      expect(series.getGeneratedCount()).toBe(0);
      expect(series.pullDomainEvents()).toEqual([new TodoSeriesStartedEvent("series-1", "user-1")]);
    });

    it("만들 수 있는 날짜가 없으면 TODO_0843이고 입력을 상세에 담는다", () => {
      // Given
      const rule = RepeatRule.daily({ type: "UNTIL", date: "2026-11-04" });
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
      expect(series.getNextOccurrenceDate()).toBe("2026-11-09");
      expect(series.getGeneratedCount()).toBe(4);
    });

    it("횟수를 다 채우면 다음 회차가 null이 되고 더 만들지 않는다", () => {
      // Given
      const series = start({ rule: RepeatRule.daily({ type: "COUNT", count: 2 }) });
      // When
      const drafts = series.planOccurrences("2026-12-31");
      // Then
      expect(drafts).toHaveLength(2);
      expect(series.getNextOccurrenceDate()).toBeNull();
      expect(series.isActive()).toBe(false);
      expect(series.planOccurrences("2027-12-31")).toEqual([]);
    });

    it("기간 안에 회차가 없으면 커서를 그대로 둔다", () => {
      // Given
      const series = start({ rule: RepeatRule.monthly(31, { type: "NEVER" }) });
      // When
      const drafts = series.planOccurrences("2026-11-20");
      // Then
      expect(drafts).toEqual([]);
      expect(series.getNextOccurrenceDate()).toBe("2026-11-30");
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
        name: "가을에 겹치는 시각은 기존 helper대로 EST",
        date: "2027-11-07",
        time: "01:30",
        expected: "2027-11-07T06:30:00.000Z",
      },
    ])("뉴욕 DST: $name", ({ date, time, expected }) => {
      // Given
      const series = start({
        rule: RepeatRule.daily({ type: "NEVER" }),
        startDate: date,
        scheduledLocalTime: time,
        timezone: "America/New_York",
      });
      // When
      const [draft] = series.planOccurrences(date);
      // Then
      expect(draft?.scheduledTime?.toISOString()).toBe(expected);
      expect(draft?.isAllDay).toBe(false);
    });
  });

  describe("반복 끝내기", () => {
    it("다음 회차를 지우고 한 번만 끝난다", () => {
      // Given
      const series = start();
      series.pullDomainEvents();
      // When
      const first = series.stopAfter("2026-11-10");
      const second = series.stopAfter("2026-11-10");
      // Then
      expect(first).toBe(true);
      expect(second).toBe(false);
      expect(series.getNextOccurrenceDate()).toBeNull();
      expect(series.getRule().getEnd()).toEqual({ type: "UNTIL", date: "2026-11-10" });
      expect(series.pullDomainEvents()).toEqual([new TodoSeriesEndedEvent("series-1", "user-1")]);
    });

    it("모두 만들었어도 뒤에 회차가 남았으면 끝낼 수 있다", () => {
      // Given
      const series = start({ rule: RepeatRule.daily({ type: "COUNT", count: 5 }) });
      series.planOccurrences("2026-12-31");
      // When
      const stopped = series.stopAfter("2026-11-06");
      // Then
      expect(stopped).toBe(true);
    });

    it("마지막 회차 뒤에서는 끝낼 게 없다", () => {
      // Given
      const series = start({ rule: RepeatRule.daily({ type: "COUNT", count: 2 }) });
      series.planOccurrences("2026-12-31");
      // When
      const stopped = series.stopAfter("2026-11-06");
      // Then
      expect(stopped).toBe(false);
    });
  });

  describe("분할", () => {
    it("앞쪽은 전날로 끝나고 뒤쪽은 남은 횟수를 이어받는다", () => {
      // Given
      const series = start({ rule: RepeatRule.daily({ type: "COUNT", count: 10 }) });
      series.planOccurrences("2026-11-10");
      // When
      const next = series.splitFrom("2026-11-08", { title: "새 제목" }, "series-2", 5, AT);
      // Then
      expect(series.getRule().getEnd()).toEqual({ type: "UNTIL", date: "2026-11-07" });
      expect(series.isActive()).toBe(false);
      expect(next.getId()).toBe("series-2");
      expect(next.getTitle()).toBe("새 제목");
      expect(next.getStartDate()).toBe("2026-11-08");
      expect(next.getRule().getEnd()).toEqual({ type: "COUNT", count: 7 });
      expect(next.getNextOccurrenceDate()).toBe("2026-11-08");
    });

    it("규칙을 새로 주면 그 규칙으로 잇는다", () => {
      // Given
      const series = start();
      const rule = RepeatRule.weekly(["MON"], 1, { type: "NEVER" });
      // When
      const next = series.splitFrom("2026-11-08", { rule }, "series-2", 5, AT);
      // Then
      expect(next.getRule().equals(rule)).toBe(true);
      expect(next.getNextOccurrenceDate()).toBe("2026-11-09");
    });
  });

  describe("규칙·체크리스트 교체", () => {
    it("규칙을 바꾸면 처음부터 다시 세고 같은 규칙이면 false다", () => {
      // Given
      const series = start();
      series.planOccurrences("2026-11-10");
      const rule = RepeatRule.weekly(["FRI"], 1, { type: "NEVER" });
      // When
      const changed = series.replaceRule(rule);
      const same = series.replaceRule(RepeatRule.weekly(["FRI"], 1, { type: "NEVER" }));
      // Then
      expect(changed).toBe(true);
      expect(same).toBe(false);
      expect(series.getGeneratedCount()).toBe(0);
      expect(series.getNextOccurrenceDate()).toBe("2026-11-06");
    });

    it("맞는 날짜가 없는 규칙으로는 바꿀 수 없다", () => {
      // Given
      const series = start();
      // When / Then
      expect(() =>
        series.replaceRule(RepeatRule.daily({ type: "UNTIL", date: "2026-11-01" })),
      ).toThrow(expect.objectContaining({ errorCode: ErrorCode.TODO_0843 }));
      expect(series.getNextOccurrenceDate()).toBe("2026-11-05");
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
      expect(series.getVisibility()).toBe("PRIVATE");
      expect(series.getScheduledLocalTime()).toBe("09:00");
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
      expect(series.getScheduledLocalTime()).toBeNull();
    });
  });

  describe("자리 비운 동안 멈춘 커서", () => {
    const LAST_MOVED_AT = new Date("2026-06-01T00:00:00.000Z");
    const RETURNED_AT = new Date("2026-11-05T03:00:00.000Z");

    /** 6월 1일에 마지막으로 채워 커서가 멈춘 규칙 */
    function stale(rule: RepeatRule, nextOccurrenceDate: string, generatedCount = 0): TodoSeries {
      return TodoSeries.reconstitute({
        ...start({
          rule,
          startDate: "2026-03-01",
          timezone: "UTC",
          at: LAST_MOVED_AT,
        }).toPersistence(),
        nextOccurrenceDate,
        generatedCount,
      });
    }

    it("오늘 이후 첫 회차로 옮기고 지난 날은 만들지 않는다", () => {
      // Given
      const series = stale(RepeatRule.daily({ type: "NEVER" }), "2026-08-30", 182);
      // When
      const skipped = series.skipDormantGap(RETURNED_AT);
      const drafts = series.planOccurrences("2027-02-03");
      // Then
      expect(skipped).toBe(true);
      expect(drafts.at(0)?.occurrenceDate).toBe("2026-11-05");
      expect(drafts).toHaveLength(91);
      expect(series.getNextOccurrenceDate()).toBe("2027-02-04");
    });

    it("다시 불러도 바뀌지 않는다", () => {
      // Given
      const series = stale(RepeatRule.daily({ type: "NEVER" }), "2026-08-30");
      series.skipDormantGap(RETURNED_AT);
      // When
      const again = series.skipDormantGap(RETURNED_AT);
      // Then
      expect(again).toBe(false);
      expect(series.getNextOccurrenceDate()).toBe("2026-11-05");
    });

    it("커서가 오늘이면 옮길 것이 없다", () => {
      // Given
      const series = stale(RepeatRule.daily({ type: "NEVER" }), "2026-11-05");
      // When
      const skipped = series.skipDormantGap(RETURNED_AT);
      // Then
      expect(skipped).toBe(false);
      expect(series.getNextOccurrenceDate()).toBe("2026-11-05");
    });

    it("최근에 움직인 규칙의 지난 날짜는 이어서 채운다", () => {
      // Given
      const series = TodoSeries.reconstitute({
        ...start({ startDate: "2026-10-30", timezone: "UTC", at: RETURNED_AT }).toPersistence(),
      });
      // When
      const skipped = series.skipDormantGap(RETURNED_AT);
      // Then
      expect(skipped).toBe(false);
      expect(series.getNextOccurrenceDate()).toBe("2026-10-30");
    });

    it("규칙 시간대의 오늘로 잰다", () => {
      // Given
      const seoul = TodoSeries.reconstitute({
        ...stale(RepeatRule.daily({ type: "NEVER" }), "2026-08-30").toPersistence(),
        timezone: "Asia/Seoul",
      });
      const newYork = TodoSeries.reconstitute({
        ...stale(RepeatRule.daily({ type: "NEVER" }), "2026-08-30").toPersistence(),
        timezone: "America/New_York",
      });
      const at = new Date("2026-11-05T16:00:00.000Z");
      // When
      seoul.skipDormantGap(at);
      newYork.skipDormantGap(at);
      // Then
      expect(seoul.getNextOccurrenceDate()).toBe("2026-11-06");
      expect(newYork.getNextOccurrenceDate()).toBe("2026-11-05");
    });

    it("UNTIL이 지났으면 끝난 규칙이고 새 규칙을 만들지 않는다", () => {
      // Given
      const series = stale(RepeatRule.daily({ type: "UNTIL", date: "2026-10-01" }), "2026-08-30");
      // When
      const skipped = series.skipDormantGap(RETURNED_AT);
      // Then
      expect(skipped).toBe(true);
      expect(series.getNextOccurrenceDate()).toBeNull();
      expect(series.isActive()).toBe(false);
      expect(series.planOccurrences("2027-02-03")).toEqual([]);
    });

    it("UNTIL이 오늘이면 오늘 회차 하나만 남는다", () => {
      // Given
      const series = stale(RepeatRule.daily({ type: "UNTIL", date: "2026-11-05" }), "2026-08-30");
      // When
      series.skipDormantGap(RETURNED_AT);
      const drafts = series.planOccurrences("2027-02-03");
      // Then
      expect(drafts.map((draft) => draft.occurrenceDate)).toEqual(["2026-11-05"]);
      expect(series.getNextOccurrenceDate()).toBeNull();
    });

    it("COUNT는 달력으로 세어 그 횟수의 날짜가 다 지났으면 끝난다", () => {
      // Given
      const series = stale(RepeatRule.daily({ type: "COUNT", count: 100 }), "2026-05-20", 80);
      // When
      series.skipDormantGap(RETURNED_AT);
      // Then
      expect(series.getNextOccurrenceDate()).toBeNull();
      expect(series.getGeneratedCount()).toBe(100);
    });

    it("COUNT가 남았으면 지난 날짜를 횟수에 넣고 남은 만큼만 만든다", () => {
      // Given
      const series = stale(RepeatRule.daily({ type: "COUNT", count: 250 }), "2026-05-20", 80);
      // When
      series.skipDormantGap(RETURNED_AT);
      const drafts = series.planOccurrences("2027-02-03");
      // Then
      expect(series.getGeneratedCount()).toBe(250);
      expect(drafts.at(0)?.occurrenceDate).toBe("2026-11-05");
      expect(drafts).toHaveLength(250 - 249);
    });

    it("격주는 시작 주를 기준으로 그대로 이어진다", () => {
      // Given
      const rule = RepeatRule.weekly(["MON"], 2, { type: "NEVER" });
      const series = TodoSeries.reconstitute({
        ...start({
          rule,
          startDate: "2026-03-02",
          timezone: "UTC",
          at: LAST_MOVED_AT,
        }).toPersistence(),
        nextOccurrenceDate: "2026-08-17",
      });
      // When
      series.skipDormantGap(RETURNED_AT);
      // Then
      expect(series.getNextOccurrenceDate()).toBe("2026-11-09");
    });

    it("매월 31일은 짧은 달의 말일로 이어진다", () => {
      // Given
      const rule = RepeatRule.monthly(31, { type: "NEVER" });
      const series = stale(rule, "2026-08-31");
      // When
      series.skipDormantGap(RETURNED_AT);
      // Then
      expect(series.getNextOccurrenceDate()).toBe("2026-11-30");
    });
  });
});
