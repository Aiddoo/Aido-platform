export interface TodoReminderSchedule {
  readonly todoId: number;
  readonly scheduledTime: Temporal.Instant;
  readonly userId: string;
}

/**
 * Todo 리마인더 스케줄링 포트 (scheduler 컨텍스트 경계)
 *
 * todo 모듈이 소유하는 계약입니다. 구현은 인프라 어댑터가
 * scheduler 모듈의 IReminderScheduler에 위임합니다.
 */
export abstract class TodoReminderSchedulerPort {
  /**
   * 리마인더 등록 — 같은 todoId로 재호출 시 기존 예약을 대체합니다.
   * 기존 예약 취소나 새 작업 등록 실패는 reject됩니다.
   */
  abstract scheduleReminder(
    todoId: number,
    scheduledTime: Temporal.Instant,
    userId: string,
  ): Promise<void>;

  /** 새로 만든 회차의 리마인더를 한 번에 등록한다. 이미 지난 시각은 등록하지 않는다. */
  abstract scheduleReminders(reminders: readonly TodoReminderSchedule[]): Promise<void>;

  /** 예약을 한 번에 지운다. 없는 작업은 무시하고 인프라 실패만 reject된다. */
  abstract cancelReminders(todoIds: readonly number[]): Promise<void>;
}
