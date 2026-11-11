/**
 * 예정 시각 뒤 실행이 만들어지고 재시도까지 끝나기를 기다리는 여유. 배포로 멈춘 몇 분과
 * 스케줄 작업의 가장 긴 만료 시간(30분)을 덮는다.
 */
const SCHEDULE_RUN_GRACE = Temporal.Duration.from({ minutes: 30 });

// DB 시계로 기록된 실행이 앱 시계의 예정 시각보다 조금 앞서 보여도 창에 넣는다
const CLOCK_SKEW_TOLERANCE = Temporal.Duration.from({ minutes: 1 });
const PREVIEW_PAGE_SIZE = 50;
const MAX_PREVIEW_PAGES = 20;
// 평일만 도는 cron처럼 간격이 고르지 않으면 찾는 범위를 넓힌다
const MAX_LOOKBACK_WIDENINGS = 4;
const LOOKBACK_WIDENING_FACTOR = 4;

/** `after`보다 뒤의 예정 시각을 오름차순으로 `count`개까지 준다(cron 해석은 스케줄러와 같은 엔진). */
export type ScheduleOccurrencePreview = (
  after: Temporal.Instant,
  count: number,
) => Promise<readonly Temporal.Instant[]>;

/** 지금까지 실행이 끝났어야 할 가장 최근 예정 시각 두 개. */
export interface DueRuns {
  readonly latest: Temporal.Instant;
  /** 배포나 `missed: "skip"`으로 한 번 빠지는 것은 넘기려고 두 번째 것부터 본다 */
  readonly previous: Temporal.Instant;
}

/**
 * `now - SCHEDULE_RUN_GRACE`까지의 마지막 예정 시각 두 개를 찾는다. 실제 예정 시각을 쓰므로 일광절약
 * 시간대의 23·25시간 날과 고르지 않은 cron에서도 "간격 × 2 + 여유"가 맞다. 끝난 규칙이면 null이다.
 */
export async function findDueRuns({
  now,
  preview,
}: {
  readonly now: Temporal.Instant;
  readonly preview: ScheduleOccurrencePreview;
}): Promise<DueRuns | null> {
  const dueUntil = now.subtract(SCHEDULE_RUN_GRACE);
  const [next, afterNext] = await preview(dueUntil, 2);
  if (next == null || afterNext == null) {
    return null;
  }
  let lookbackMs = 2 * (afterNext.epochMilliseconds - next.epochMilliseconds);
  for (let widening = 0; widening <= MAX_LOOKBACK_WIDENINGS; widening += 1) {
    const due = await lastTwoOccurrences(
      preview,
      dueUntil.subtract({ milliseconds: lookbackMs }),
      dueUntil,
    );
    if (due != null) {
      return due;
    }
    lookbackMs *= LOOKBACK_WIDENING_FACTOR;
  }
  return null;
}

async function lastTwoOccurrences(
  preview: ScheduleOccurrencePreview,
  after: Temporal.Instant,
  until: Temporal.Instant,
): Promise<DueRuns | null> {
  let previous: Temporal.Instant | null = null;
  let latest: Temporal.Instant | null = null;
  let cursor = after;
  for (let pageIndex = 0; pageIndex < MAX_PREVIEW_PAGES; pageIndex += 1) {
    const page = await preview(cursor, PREVIEW_PAGE_SIZE);
    for (const occurrence of page) {
      if (Temporal.Instant.compare(occurrence, until) > 0) {
        return toDueRuns(previous, latest);
      }
      previous = latest;
      latest = occurrence;
    }
    const last = page.at(-1);
    if (last == null || page.length < PREVIEW_PAGE_SIZE) {
      return toDueRuns(previous, latest);
    }
    cursor = last;
  }
  // until까지 다 읽지 못했으면 가장 최근 예정 시각을 모른다
  return null;
}

function toDueRuns(
  previous: Temporal.Instant | null,
  latest: Temporal.Instant | null,
): DueRuns | null {
  return previous == null || latest == null ? null : { previous, latest };
}

/**
 * 판정할 수 있으면 실행을 셀 창의 시작을, 아직 판정할 수 없으면 null을 준다.
 * - 앞 예정 시각보다 늦게 등록된 스케줄은 아직 두 번의 기회가 없었다.
 * - 가장 최근 예정 실행이 끝났더라도 보관 기간이 지나 지워졌을 수 있으면 "실행 없음"과 구분할 수 없다.
 */
export function scheduleRunWindowStart({
  now,
  due,
  registeredAt,
  finishedRunRetentionSeconds,
}: {
  readonly now: Temporal.Instant;
  readonly due: DueRuns;
  readonly registeredAt: Temporal.Instant;
  readonly finishedRunRetentionSeconds: number;
}): Temporal.Instant | null {
  if (Temporal.Instant.compare(registeredAt, due.previous) > 0) {
    return null;
  }
  const latestRunVisibleUntil = due.latest.add({ seconds: finishedRunRetentionSeconds });
  if (Temporal.Instant.compare(latestRunVisibleUntil, now) <= 0) {
    return null;
  }
  return due.previous.subtract(CLOCK_SKEW_TOLERANCE);
}

/** 창 안에서 만들어진 스케줄 실행 수. */
export interface ScheduleRunCounts {
  readonly completed: number;
  readonly failed: number;
  /** 아직 끝나지 않은(대기·재시도·실행 중) 실행 가운데 가장 오래된 것의 생성 시각 */
  readonly oldestPendingCreatedAt: Temporal.Instant | null;
}

const SCHEDULE_VERDICTS = ["healthy", "in-progress", "failing", "overdue"] as const;
export type ScheduleVerdict = (typeof SCHEDULE_VERDICTS)[number];

/**
 * 창 안의 실행으로 스케줄 상태를 판정한다.
 * - 끝난 실행이 하나라도 있으면 정상이다.
 * - 실행은 있었는데 모두 실패했으면 failing이다.
 * - 아직 여유 시간 안에 만들어진 실행만 남아 있으면 진행 중이다.
 * - 그 밖(실행이 없거나 여유 시간을 넘겨 멈춰 있음)은 overdue다.
 */
export function judgeScheduleRuns({
  now,
  runs,
}: {
  readonly now: Temporal.Instant;
  readonly runs: ScheduleRunCounts;
}): ScheduleVerdict {
  if (runs.completed > 0) {
    return "healthy";
  }
  if (runs.failed > 0) {
    return "failing";
  }
  const stalledBefore = now.subtract(SCHEDULE_RUN_GRACE);
  if (
    runs.oldestPendingCreatedAt != null &&
    Temporal.Instant.compare(runs.oldestPendingCreatedAt, stalledBefore) > 0
  ) {
    return "in-progress";
  }
  return "overdue";
}
