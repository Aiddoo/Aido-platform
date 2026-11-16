import { CATEGORY_COLORS } from '@src/features/planning/category/constants/todo-category.constants';

/** 무료 리포트 화면이 주간·월간마다 보여 주는 예시 리포트 수. 지난주·지난달부터 거꾸로 센다 */
export const SAMPLE_REPORT_COUNT = 4;

/** 예시 하루 할 일 수(월~일). 주말은 적게 잡는다 */
export const SAMPLE_DAILY_TODO_COUNTS = [5, 6, 4, 5, 6, 3, 3] as const;

/**
 * 예시 기간마다 요일별로 못 끝낸 할 일 수(월~일). 첫 줄이 지난주·지난달이다.
 * 주간은 최근 8주 추세까지, 월간은 맨 아래 예시의 지난번 비교까지 읽어 개수보다 길다
 */
export const SAMPLE_MISSED_TODO_COUNTS = {
  WEEKLY: [
    [2, 1, 2, 2, 0, 0, 0],
    [2, 2, 1, 2, 2, 2, 0],
    [1, 2, 2, 1, 3, 0, 0],
    [2, 2, 2, 2, 2, 2, 0],
    [2, 2, 2, 2, 2, 2, 1],
    [1, 2, 1, 2, 2, 1, 1],
    [2, 2, 2, 2, 3, 2, 1],
    [2, 2, 2, 2, 2, 2, 1],
  ],
  MONTHLY: [
    [2, 1, 2, 1, 1, 1, 0],
    [2, 2, 1, 2, 2, 1, 1],
    [1, 2, 2, 1, 2, 1, 1],
    [2, 2, 2, 2, 2, 1, 1],
    [2, 2, 2, 2, 2, 2, 1],
  ],
} as const;

/** 예시 기간 끝에 할 일을 모두 끝낸 날 수. 이 기간 연속이 되고, 이 날들은 위 표의 못 끝낸 수를 보지 않는다 */
export const SAMPLE_TRAILING_PERFECT_DAYS = {
  WEEKLY: [3, 1, 2, 1, 0, 0, 0, 0],
  MONTHLY: [5, 2, 3, 1, 0],
} as const;

/** 예시로 끝낸 시각의 비중. 코치 글이 말하는 아침 7시가 가장 많고 나머지는 이 시각에 더한다 */
export const SAMPLE_COMPLETION_HOUR_WEIGHTS = [
  { hour: 7, weight: 6 },
  { hour: 8, weight: 4 },
  { hour: 9, weight: 2 },
  { hour: 12, weight: 3 },
  { hour: 13, weight: 1 },
  { hour: 18, weight: 2 },
  { hour: 21, weight: 5 },
  { hour: 22, weight: 2 },
] as const;

/** 예시 카테고리의 할 일·못 끝낸 할 일 몫. 코치 글처럼 업무가 가장 꾸준하고 운동이 가장 자주 밀린다. 운동은 남은 몫이다 */
export const SAMPLE_CATEGORY_SHARES = {
  work: { todoShare: 0.45, missedShare: 0.2, color: CATEGORY_COLORS[9] },
  study: { todoShare: 0.3, missedShare: 0.35, color: CATEGORY_COLORS[11] },
  workout: { color: CATEGORY_COLORS[6] },
} as const;
