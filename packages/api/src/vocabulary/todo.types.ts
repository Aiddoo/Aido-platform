export const TODO_VISIBILITIES = ["PUBLIC", "PRIVATE"] as const;
export type TodoVisibility = (typeof TODO_VISIBILITIES)[number];

export const DAYS_OF_WEEK = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export const TODO_REPEAT_FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY"] as const;
export type TodoRepeatFrequency = (typeof TODO_REPEAT_FREQUENCIES)[number];

// oxlint-disable-next-line aido/time-constant-unit -- 시간 길이가 아니라 반복 주기 배수(1주·2주마다)다
export const TODO_REPEAT_INTERVALS = [1, 2] as const;
export type TodoRepeatInterval = (typeof TODO_REPEAT_INTERVALS)[number];

export const TODO_REPEAT_END_TYPES = ["NEVER", "UNTIL", "COUNT"] as const;

export const TODO_EDIT_SCOPES = ["THIS_ONLY", "THIS_AND_FOLLOWING", "ALL"] as const;
export type TodoEditScope = (typeof TODO_EDIT_SCOPES)[number];

/** 수정은 전체 범위가 없다. 첫 회차에서 이후를 고르면 전체를 고친 것과 같다. */
export const TODO_UPDATE_SCOPES = ["THIS_ONLY", "THIS_AND_FOLLOWING"] as const;
export type TodoUpdateScope = (typeof TODO_UPDATE_SCOPES)[number];

export const DAY_OF_WEEK_MAP: Record<DayOfWeek, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
} as const;

/** 월~일 순서 배열 (UI/통계 표시용) */
export const DAY_OF_WEEK_ORDER: DayOfWeek[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

/** 요일 한글 매핑 */
export const DAY_OF_WEEK_KO: Record<DayOfWeek, string> = {
  MON: "월",
  TUE: "화",
  WED: "수",
  THU: "목",
  FRI: "금",
  SAT: "토",
  SUN: "일",
} as const;

/**
 * dayjs.day() (0=일요일) → DayOfWeek 변환
 *
 * dayjs는 일요일=0, 월요일=1 ... 토요일=6을 반환하지만,
 * DAY_OF_WEEK_ORDER는 월~일 순서이므로 인덱스 변환이 필요합니다.
 */
export function dayIndexToDayOfWeek(dayIndex: number): DayOfWeek {
  return DAY_OF_WEEK_ORDER[(dayIndex + 6) % 7] ?? "MON";
}
