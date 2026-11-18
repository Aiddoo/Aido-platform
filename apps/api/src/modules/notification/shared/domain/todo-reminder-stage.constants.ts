/**
 * 할 일을 알리는 리마인드 알림의 단계(metadata.stage). 완료·다시 알림 버튼은 이 단계에만 붙고,
 * 다시 알림도 이 단계의 알림에서만 받는다
 */
const ACTIONABLE_TODO_REMINDER_STAGES = ["60min", "10min", "snooze"] as const;
type ActionableTodoReminderStage = (typeof ACTIONABLE_TODO_REMINDER_STAGES)[number];

export const SNOOZED_TODO_REMINDER_STAGE = "snooze" satisfies ActionableTodoReminderStage;

/** 반복 할 일 알림을 멈췄다는 안내. 같은 TODO_REMINDER로 보내지만 할 일을 알리지 않아 버튼이 없다 */
export const TODO_SERIES_PAUSED_STAGE = "series-paused";

export function isActionableTodoReminderStage(stage: unknown): boolean {
  return ACTIONABLE_TODO_REMINDER_STAGES.some((actionable) => actionable === stage);
}
