/**
 * 리마인더 시간 변경 페이로드.
 *
 * scheduler의 ReminderHourChangedJobData와 동일 계약(어댑터가 위임).
 */
export interface ReminderHourChangedPayload {
  userId: string;
  timezone: string;
  morningReminderHour?: number;
  morningReminderMinute?: number;
  eveningReminderHour?: number;
  eveningReminderMinute?: number;
}

/**
 * 리마인더 스케줄 즉시 반영 포트.
 *
 * 리마인더 시간 변경 시 즉시 반영 큐 잡을 등록한다(fire-and-forget void).
 */
export abstract class ReminderScheduleEnqueuerPort {
  abstract enqueueReminderHourChanged(payload: ReminderHourChangedPayload): void;
}

/** 옛 토큰. 아직 옮기지 않은 소비 Context가 쓴다(같은 인스턴스 별칭으로 바인딩) */
export const REMINDER_SCHEDULE_ENQUEUER = Symbol("REMINDER_SCHEDULE_ENQUEUER");
