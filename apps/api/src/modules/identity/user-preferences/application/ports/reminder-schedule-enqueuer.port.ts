import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

/** 리마인더 시간 변경. 어댑터가 notification 큐 payload로 옮긴다. */
export interface ReminderHourChangedPayload {
  userId: UserId;
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
