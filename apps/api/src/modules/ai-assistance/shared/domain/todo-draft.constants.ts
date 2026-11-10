import type { DayOfWeek, TodoRepeatInterval } from "@aido/api/vocabulary";

/** 반복 끝. 공개 계약 todoRepeatSchema의 end와 같은 모양이라 응답에 그대로 싣는다 */
export type TodoRepeatEndRule =
  | { readonly type: "NEVER" }
  | { readonly type: "UNTIL"; readonly date: string }
  | { readonly type: "COUNT"; readonly count: number };

/** 서버가 정한 반복 규칙. 공개 계약 todoRepeatSchema와 같은 모양이다(요일 배열은 계약에 그대로 넘기려고 변경 가능 배열) */
export type TodoRepeatRule =
  | { readonly frequency: "DAILY"; readonly end: TodoRepeatEndRule }
  | {
      readonly frequency: "WEEKLY";
      readonly interval: TodoRepeatInterval;
      readonly weekdays: DayOfWeek[];
      readonly end: TodoRepeatEndRule;
    }
  | { readonly frequency: "MONTHLY"; readonly monthDay: number; readonly end: TodoRepeatEndRule };

/**
 * LLM이 문장에서 읽은 일정 표현의 중간 표현(IR).
 * 날짜·요일·시각 계산은 담지 않고, 표현의 종류와 말한 숫자만 담는다.
 * 말하지 않은 칸은 모델 출력부터 끝까지 null이다(업체 공통 구조화 출력 규칙).
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
  readonly amount: number | null;
  readonly weekday: DayOfWeek | null;
  readonly weekOffset: number | null;
  readonly month: number | null;
  readonly day: number | null;
  readonly year: number | null;
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
  readonly hour: number | null;
  readonly minute: number | null;
  readonly meridiem: "AM" | "PM" | "NONE" | null;
  readonly partOfDay: PartOfDay | null;
  readonly relativeMinutes: number | null;
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
  readonly daysOfWeek: readonly DayOfWeek[] | null;
  readonly until: DateRef | null;
  readonly forDuration: {
    readonly unit: "DAY" | "WEEK" | "MONTH";
    readonly amount: number;
  } | null;
}

/** 계획 프롬프트의 반복 표현. 출시 parse 응답에 없는 매월 날짜를 더한다. */
export interface PlanRepeatRef extends RepeatRef {
  /** MONTHLY_DAY의 날짜(1~31) */
  readonly monthDay: number | null;
}

export interface ScheduleDraft<R extends RepeatRef = RepeatRef> {
  readonly date: DateRef;
  readonly endDate: DateRef | null;
  readonly time: TimeRef | null;
  readonly repeat: R;
}

export type TodoDraftIntent = "TASK" | "NO_ACTION";

export interface TodoDraft extends ScheduleDraft {
  readonly intent: TodoDraftIntent;
  readonly title: string;
  readonly categoryId: number | null;
}

export type ScheduleWarning =
  | "INVALID_DATE"
  | "INVALID_TIME"
  | "END_BEFORE_START"
  | "REPEAT_END_NOT_AFTER_START"
  | "UNSUPPORTED_RECURRENCE"
  | "EMPTY_RECURRENCE";

/** 서버가 결정적으로 계산한 일정. 공개 계약의 날짜·시각 필드와 같은 형식이다. */
export interface ResolvedSchedule {
  readonly startDate: string;
  readonly endDate: string | null;
  readonly scheduledTime: string | null;
  readonly isAllDay: boolean;
  readonly isRecurring: boolean;
  /** 출시 앱용 요일 + 종료일. 종료를 말하지 않으면 기본 기간으로 채운다. */
  readonly recurrence: { readonly daysOfWeek: DayOfWeek[]; readonly endDate: string } | null;
  /** 반복 규칙. 종료를 말하지 않으면 계속 반복이다. */
  readonly repeat: TodoRepeatRule | null;
  readonly warnings: readonly ScheduleWarning[];
}
