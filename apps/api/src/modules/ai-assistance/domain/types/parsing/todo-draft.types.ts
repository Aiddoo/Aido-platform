import type { DayOfWeek } from "@aido/api/vocabulary";

/**
 * LLM이 문장에서 읽은 일정 표현의 중간 표현(IR).
 * 날짜·요일·시각 계산은 담지 않고, 표현의 종류와 말한 숫자만 담는다.
 */
export type DateRefKind =
  | "NONE"
  | "TODAY"
  | "OFFSET_DAYS"
  | "OFFSET_WEEKS"
  | "OFFSET_MONTHS"
  | "WEEKDAY"
  | "CALENDAR_DATE"
  | "MONTH_START"
  | "MONTH_END"
  | "YEAR_START"
  | "YEAR_END";

export interface DateRef {
  readonly kind: DateRefKind;
  readonly amount?: number;
  readonly weekday?: DayOfWeek;
  readonly weekOffset?: number;
  readonly month?: number;
  readonly day?: number;
  readonly year?: number;
}

export type PartOfDay =
  | "DAWN"
  | "MORNING"
  | "NOON"
  | "AFTERNOON"
  | "EVENING"
  | "NIGHT"
  | "MIDNIGHT";

export interface TimeRef {
  readonly hour?: number;
  readonly minute?: number;
  readonly meridiem?: "AM" | "PM" | "NONE";
  readonly partOfDay?: PartOfDay;
  readonly relativeMinutes?: number;
}

/**
 * 반복 표현 종류. BIWEEKLY_DAYS·MONTHLY_DAY는 반복 할 일(TodoSeries)이 생기면서 계획 프롬프트가 먼저 쓰고,
 * 출시 parse 응답의 recurrence(요일 + 종료일)로는 나타낼 수 없어 그 경로에서는 UNSUPPORTED와 같게 다룬다.
 */
export type RepeatPattern =
  | "NONE"
  | "WEEKLY_DAYS"
  | "BIWEEKLY_DAYS"
  | "MONTHLY_DAY"
  | "DAILY"
  | "WEEKDAYS"
  | "WEEKENDS"
  | "THIS_WEEK"
  | "NEXT_WEEK"
  | "WEEK_AFTER_NEXT"
  | "THIS_WEEKEND"
  | "NEXT_WEEKEND"
  | "THIS_WEEKDAYS"
  | "UNSUPPORTED";

export interface RepeatRef {
  readonly pattern: RepeatPattern;
  readonly daysOfWeek?: readonly DayOfWeek[];
  /** MONTHLY_DAY의 날짜(1~31) */
  readonly monthDay?: number;
  readonly until?: DateRef;
  readonly forDuration?: { readonly unit: "DAY" | "WEEK" | "MONTH"; readonly amount: number };
}

export interface ScheduleDraft {
  readonly date: DateRef;
  readonly endDate?: DateRef;
  readonly time: TimeRef | null;
  readonly repeat: RepeatRef;
}

export type TodoDraftIntent = "TASK" | "NO_ACTION";

export interface TodoDraft extends ScheduleDraft {
  readonly intent: TodoDraftIntent;
  readonly title: string;
  readonly categoryId?: number;
}

export type ScheduleWarning =
  | "INVALID_DATE"
  | "INVALID_TIME"
  | "END_BEFORE_START"
  | "UNSUPPORTED_RECURRENCE"
  | "EMPTY_RECURRENCE";

/** 서버가 결정적으로 계산한 일정. 공개 계약의 날짜·시각 필드와 같은 형식이다. */
export interface ResolvedSchedule {
  readonly startDate: string;
  readonly endDate: string | null;
  readonly scheduledTime: string | null;
  readonly isAllDay: boolean;
  readonly isRecurring: boolean;
  readonly recurrence: { readonly daysOfWeek: DayOfWeek[]; readonly endDate: string } | null;
  readonly warnings: readonly ScheduleWarning[];
}
