import { instantFromDate } from "#api/shared/domain/time/instant";

import {
  type CalendarDay,
  formatDay,
  isAfter,
  isBefore,
  resolveDateRef,
  resolveEndDateRef,
} from "./schedule-date.domain-service.js";
import {
  hasSpokenRepeatEnd,
  type RecurrenceWindow,
  resolveRecurrenceEnd,
  resolveRecurrenceWindow,
  resolveRepeat,
  resolveSpokenRepeatEnd,
} from "./schedule-recurrence.domain-service.js";
import {
  formatMinutes,
  isRelativeTime,
  resolveTime,
  type ScheduleClock,
} from "./schedule-time.domain-service.js";
import type {
  PlanRepeatRef,
  RepeatPattern,
  RepeatRef,
  ResolvedSchedule,
  ScheduleDraft,
  ScheduleWarning,
  TodoRepeatRule,
} from "./todo-draft.constants.js";

/** 요일 + 종료일 recurrence로 나타낼 수 없는 반복 */
const UNREPRESENTABLE_REPEAT_PATTERNS: ReadonlySet<RepeatPattern> = new Set([
  "UNSUPPORTED",
  "BIWEEKLY_DAYS",
  "MONTHLY_DAY",
]);

const ONCE_ON_WEEKEND_PATTERNS: ReadonlySet<RepeatPattern> = new Set([
  "THIS_WEEKEND",
  "NEXT_WEEKEND",
]);

/** 사용자 시간대의 지금 */
interface LocalNow {
  readonly today: CalendarDay;
  readonly nowMinutes: number;
}

interface StartResolution {
  readonly startDay: CalendarDay;
  readonly scheduledMinutes: number | null;
}

/**
 * LLM이 읽은 일정 표현을 사용자 시간대 기준 날짜·시각·반복으로 결정적으로 바꾼다.
 * 같은 draft·now·timeZone이면 항상 같은 결과를 낸다.
 */
export function resolveTodoSchedule(
  draft: ScheduleDraft<RepeatRef | PlanRepeatRef>,
  clock: ScheduleClock,
): ResolvedSchedule {
  const local = instantFromDate(clock.now).toZonedDateTimeISO(clock.timeZone);
  const now: LocalNow = { today: local.toPlainDate(), nowMinutes: local.hour * 60 + local.minute };
  const { today } = now;
  const warnings: ScheduleWarning[] = [];

  const resolvedDate = resolveDateRef(draft.date, today);
  if (resolvedDate.warning != null) {
    warnings.push(resolvedDate.warning);
  }
  const window = resolveRecurrenceWindow(draft.repeat, today, resolvedDate.day);
  const { startDay, scheduledMinutes } = resolveStart(draft, {
    window,
    dateDay: resolvedDate.day,
    now,
    clock,
    warnings,
  });
  const endDate = resolveEndDate(draft, { startDay, today, warnings });
  const recurrence = resolveRecurrence(draft.repeat, { window, startDay, today, warnings });

  const repeat = resolveRepeat(draft.repeat, { window, start: startDay, today });
  if (
    repeat != null &&
    window?.end == null &&
    hasSpokenRepeatEnd(draft.repeat) &&
    resolveSpokenRepeatEnd(draft.repeat, startDay, today) == null
  ) {
    warnings.push("REPEAT_END_NOT_AFTER_START");
  }

  const scheduledTime = scheduledMinutes == null ? null : formatMinutes(scheduledMinutes);
  return {
    startDate: formatDay(startDay),
    endDate,
    scheduledTime,
    isAllDay: scheduledTime == null,
    isRecurring: recurrence != null,
    recurrence,
    repeat,
    warnings,
  };
}

/**
 * 계획(빠른 계획·녹음 정리)의 일정. "주말에 장보기", "this weekend"는 그 주말 토요일 한 번이고
 * (일요일에 말한 이번 주말은 오늘) 되풀이는 "주말마다"(`WEEKENDS`)일 때만이다.
 * 출시 parse 응답의 `recurrence`는 요일 + 종료일 그대로라 `resolveTodoSchedule`을 바꾸지 않는다.
 */
export function resolvePlanSchedule(
  draft: ScheduleDraft<PlanRepeatRef>,
  clock: ScheduleClock,
): ResolvedSchedule {
  const schedule = resolveTodoSchedule(draft, clock);
  return ONCE_ON_WEEKEND_PATTERNS.has(draft.repeat.pattern)
    ? { ...schedule, isRecurring: false, recurrence: null, repeat: null }
    : schedule;
}

/**
 * 출시 parse 응답은 "이번 주말 X"를 토·일 + 그 주 일요일까지로 준다. 새 반복 규칙(repeat)에서는 끝이 시작 다음 날까지인
 * 주말 반복을 반복이 아니라 시작일 한 번으로 본다. 앱 `TodoRepeatPolicy.isSingleWeekendRepeat`와 같은 판단이다.
 */
export function isSingleWeekendRepeat(repeat: TodoRepeatRule, startDate: string): boolean {
  return (
    repeat.frequency === "WEEKLY" &&
    repeat.weekdays.includes("SAT") &&
    repeat.weekdays.includes("SUN") &&
    repeat.end.type === "UNTIL" &&
    Temporal.PlainDate.from(startDate).until(Temporal.PlainDate.from(repeat.end.date)).days <= 1
  );
}

/** 시작일과 시각. 반복 일정의 시작일은 시각과 무관하게 반복 규칙이 정한다. */
function resolveStart(
  draft: ScheduleDraft<RepeatRef | PlanRepeatRef>,
  basis: {
    readonly window: RecurrenceWindow | null;
    readonly dateDay: CalendarDay;
    readonly now: LocalNow;
    readonly clock: ScheduleClock;
    readonly warnings: ScheduleWarning[];
  },
): StartResolution {
  const { window, dateDay, now, clock, warnings } = basis;
  const { today, nowMinutes } = now;
  const initialDay = window?.start ?? dateDay;
  if (draft.time == null) {
    return { startDay: initialDay, scheduledMinutes: null };
  }
  const isRelative = isRelativeTime(draft.time, draft.date);
  const time = resolveTime(draft.time, isRelative, {
    targetDay: initialDay,
    today,
    nowMinutes,
    clock,
  });
  if (time === "INVALID") {
    warnings.push("INVALID_TIME");
    return { startDay: initialDay, scheduledMinutes: null };
  }
  if (time == null) {
    return { startDay: initialDay, scheduledMinutes: null };
  }
  if (window != null) {
    return { startDay: initialDay, scheduledMinutes: time.minutes };
  }
  const passedToday = !isRelative && time.day.equals(today) && time.minutes <= nowMinutes;
  if (passedToday && draft.date.kind === "NONE") {
    // 날짜를 말하지 않은 단발 일정의 시각이 이미 지났으면 내일로 넘긴다.
    return { startDay: today.add({ days: 1 }), scheduledMinutes: time.minutes };
  }
  if (passedToday && draft.time.hour == null) {
    // "오늘 아침"처럼 오늘을 말했는데 그 때가 지났으면 날짜는 지키고 지난 기본 시각을 만들지 않는다.
    return { startDay: today, scheduledMinutes: null };
  }
  return { startDay: time.day, scheduledMinutes: time.minutes };
}

/** 말한 끝 날짜. 시작일과 같으면 기간이 아니고, 시작일보다 앞이면 버린다. */
function resolveEndDate(
  draft: ScheduleDraft<RepeatRef | PlanRepeatRef>,
  basis: {
    readonly startDay: CalendarDay;
    readonly today: CalendarDay;
    readonly warnings: ScheduleWarning[];
  },
): string | null {
  const { startDay, today, warnings } = basis;
  if (draft.endDate == null || draft.endDate.kind === "NONE") {
    return null;
  }
  const end = resolveEndDateRef(draft.endDate, today, startDay);
  if (end.warning != null) {
    warnings.push(end.warning);
  }
  if (isBefore(end.day, startDay)) {
    warnings.push("END_BEFORE_START");
    return null;
  }
  return isAfter(end.day, startDay) ? formatDay(end.day) : null;
}

/** 출시 앱이 읽는 요일 + 종료일. 그것으로 나타낼 수 없는 반복은 경고만 남긴다. */
function resolveRecurrence(
  repeat: RepeatRef,
  basis: {
    readonly window: RecurrenceWindow | null;
    readonly startDay: CalendarDay;
    readonly today: CalendarDay;
    readonly warnings: ScheduleWarning[];
  },
): ResolvedSchedule["recurrence"] {
  const { window, startDay, today, warnings } = basis;
  if (UNREPRESENTABLE_REPEAT_PATTERNS.has(repeat.pattern)) {
    warnings.push("UNSUPPORTED_RECURRENCE");
  }
  if (window == null) {
    return null;
  }
  if (window.days.length === 0) {
    warnings.push("EMPTY_RECURRENCE");
    return null;
  }
  const end = window.end ?? resolveRecurrenceEnd(repeat, startDay, today);
  return {
    daysOfWeek: [...window.days],
    endDate: formatDay(isBefore(end, startDay) ? startDay : end),
  };
}
