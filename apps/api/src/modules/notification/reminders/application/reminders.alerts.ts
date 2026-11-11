import { defineAlerts } from "#api/shared/application/alerts/define-alerts";

export const ReminderAlerts = defineAlerts("notification", {
  LATE_SKIPS_HIGH: {
    key: "notification.reminder.late-skips-high",
    severity: "warning",
    summary: "늦어서 버린 할 일 리마인더가 한 시간 기준 수를 넘었다",
    runbook:
      "배포·worker 정지나 todo-reminder 큐 적체를 /health jobs로 본다. 버린 리마인더는 다시 보내지 않는다.",
  },
  SWEEP_CATCH_UP_CAPPED: {
    key: "notification.reminder.sweep-catch-up-capped",
    severity: "error",
    summary: "시간대 리마인더 sweep이 따라잡기 상한을 넘겨 놓친 분을 버렸다",
    runbook:
      "worker가 15분 넘게 멈췄다. 배포·컨테이너 재시작·DB 장애 시각을 확인한다. details.skippedMinutes 동안의 정시 알림은 보내지 않았다.",
  },
});
