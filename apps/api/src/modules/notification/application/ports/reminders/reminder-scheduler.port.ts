export const REMINDER_SCHEDULER = Symbol("REMINDER_SCHEDULER");

export type ReminderCancellationResult =
  | { readonly status: "cancelled" }
  | { readonly status: "missing" };

export interface ReminderSchedule {
  readonly todoId: number;
  readonly scheduledTime: Date;
  readonly userId: string;
}

export interface IReminderScheduler {
  /**
   * 리마인더 타이머 등록
   *
   * scheduledTime 기준으로 REMINDER_MAX_LEAD_TIME_MS 전에 알림을 발송하도록 예약합니다.
   * 같은 todoId로 재호출하면 기존 예약을 취소하고 새로 등록합니다.
   *
   * @param todoId 대상 투두 ID
   * @param scheduledTime 투두 마감 시각
   * @param userId 사용자 ID
   */
  scheduleReminder(todoId: number, scheduledTime: Date, userId: string): Promise<void>;

  /**
   * 새 투두들의 리마인더를 한 번에 등록한다. 기존 예약이 없는 새 행에만 쓰므로 취소 없이
   * 큐에 일괄로 넣는다. 이미 지난 시각은 건너뛴다.
   */
  scheduleReminders(reminders: readonly ReminderSchedule[]): Promise<void>;

  /**
   * 리마인더 타이머 취소
   *
   * @param todoId 대상 투두 ID
   */
  cancelReminder(todoId: number): Promise<ReminderCancellationResult>;
}
