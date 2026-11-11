import { REMINDER_LATE_SKIP_REASON } from "./notification-schedule.domain-service.js";

/**
 * 투두 리마인더 다단계 스케줄 정책 (순수 도메인).
 *
 * 마감 시각(scheduledTime) 기준으로 어떤 단계의 지연 잡을 언제 예약할지 계획한다.
 * 실제 큐 등록은 인프라 어댑터가 이 계획을 실행만 한다.
 */

export interface ReminderStage {
  readonly leadTimeMs: number;
  readonly label: string;
}

/** 리마인더 단계 (큰 leadTime부터 정렬) */
export const REMINDER_STAGES: readonly ReminderStage[] = [
  { leadTimeMs: 60 * 60 * 1000, label: "60min" },
  { leadTimeMs: 10 * 60 * 1000, label: "10min" },
] as const;

/** 최대 리드 타임 (복구/크론 범위 계산용) */
const REMINDER_MAX_LEAD_TIME_MS = REMINDER_STAGES[0]?.leadTimeMs ?? 60 * 60 * 1000;

/** 예약할 단일 리마인더 잡 (label + 지연 ms) */
export interface PlannedReminderJob {
  readonly label: string;
  readonly delay: number;
}

/**
 * 마감 시각과 현재 시각으로 예약할 리마인더 잡 목록을 계획한다.
 *
 * 리드 타임을 빼도 여전히 미래인 단계만 지연 잡으로 계획한다. 이미 지난 단계는 건너뛴다.
 * 바로 보내면 정시 직전에 시간을 고칠 때마다, 시간대를 건널 때마다 알림이 쏟아진다.
 */
export function planReminderJobs(scheduledMs: number, nowMs: number): PlannedReminderJob[] {
  return REMINDER_STAGES.flatMap(({ label, leadTimeMs }) => {
    const delay = scheduledMs - leadTimeMs - nowMs;
    return delay > 0 ? [{ label, delay }] : [];
  });
}

/** 단계가 울려야 했던 시각. 알 수 없는 단계는 문구와 같이 가장 이른 단계로 본다 */
export function reminderFireAt(
  scheduledAt: Temporal.Instant,
  stageLabel: string,
): Temporal.Instant {
  const stage = REMINDER_STAGES.find(({ label }) => label === stageLabel) ?? REMINDER_STAGES[0];
  return scheduledAt.subtract({ milliseconds: stage?.leadTimeMs ?? REMINDER_MAX_LEAD_TIME_MS });
}

// 할 일이 시작된 뒤에는 "N분 뒤 시작" 문구가 틀리므로 늦음 한도 안이어도 보내지 않는다
const REMINDER_STARTED_SKIP_REASON = "todo-started";

export type ReminderLateSkipReason =
  | typeof REMINDER_LATE_SKIP_REASON
  | typeof REMINDER_STARTED_SKIP_REASON;

/**
 * 지금 보내면 늦는 단계의 사유. null이면 보낸다.
 * 마지막 발송 시각은 min(울려야 했던 시각 + limitMinutes, 할 일 시각)이고 할 일 시각 자체는 이미 늦은 것으로 본다.
 */
export function reminderLateSkipReason(params: {
  readonly scheduledAt: Temporal.Instant;
  readonly stageLabel: string;
  readonly now: Temporal.Instant;
  readonly limitMinutes: number;
}): ReminderLateSkipReason | null {
  if (Temporal.Instant.compare(params.now, params.scheduledAt) >= 0) {
    return REMINDER_STARTED_SKIP_REASON;
  }
  const lateLimit = reminderFireAt(params.scheduledAt, params.stageLabel).add({
    minutes: params.limitMinutes,
  });
  return Temporal.Instant.compare(params.now, lateLimit) > 0 ? REMINDER_LATE_SKIP_REASON : null;
}

/** 특정 todoId의 모든 단계 잡 라벨(취소 시 순회용) */
export function allReminderLabels(): string[] {
  return REMINDER_STAGES.map((stage) => stage.label);
}

/**
 * 같은 할 일의 같은 단계를 한 번만 보내는 회차 값. 날짜와 벽시계로 만든다.
 *
 * 시간대 재계산은 날짜와 벽시계를 바꾸지 않아 값이 그대로이고, 사용자가 날짜나 시간을 고치면 값이 달라진다.
 * 벽시계가 빈 행(롤백 중 옛 서버가 쓴 행)은 날짜만 쓴다.
 */
export function createReminderOccurrenceKey(
  startDate: string,
  scheduledLocalTime: string | null,
): string {
  return scheduledLocalTime == null ? startDate : `${startDate}T${scheduledLocalTime}`;
}
