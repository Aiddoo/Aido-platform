export interface ReminderSchedule {
  readonly todoId: number;
  readonly scheduledTime: Temporal.Instant;
  readonly userId: string;
}

// 할 일 시각 기준 단계별 지연 작업을 등록·취소한다. 활성 트랜잭션이 있으면 함께 커밋된다
export abstract class TodoReminderSchedulerPort {
  /** 같은 todoId로 다시 부르면 기존 예약을 지우고 새로 등록한다. */
  abstract scheduleReminder(
    todoId: number,
    scheduledTime: Temporal.Instant,
    userId: string,
  ): Promise<void>;
  /** 기존 예약이 없는 새 행에만 쓰므로 취소 없이 한 번에 넣는다. 이미 지난 단계는 건너뛴다. */
  abstract scheduleReminders(reminders: readonly ReminderSchedule[]): Promise<void>;
  abstract cancelReminders(todoIds: readonly number[]): Promise<void>;
}

// planning이 쓰는 옛 타입 이름
export type IReminderScheduler = TodoReminderSchedulerPort;
