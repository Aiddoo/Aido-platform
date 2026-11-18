/** 이전 배포가 예약한 작업을 같은 key로 취소해야 하므로 형식을 바꾸지 않는다. */
export function todoReminderJobKey(todoId: number, stageLabel: string): string {
  return `reminder_${todoId}_${stageLabel}`;
}

/** 휴면 기간 하나에 안내 하나. dormantSince는 그 기간의 마지막 활동일이다. */
export function todoSeriesPausedJobKey(userId: string, dormantSince: string): string {
  return `series-paused_${userId}_${dormantSince}`;
}

/** 누른 알림 하나에 다시 알림 하나. 같은 알림을 두 번 눌러도 작업은 하나다. */
export function todoReminderSnoozeJobKey(todoId: number, notificationId: number): string {
  return `reminder-snooze_${todoId}_${notificationId}`;
}
