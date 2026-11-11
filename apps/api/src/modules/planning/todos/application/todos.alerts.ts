import { defineAlerts } from "#api/shared/application/alerts/define-alerts";

export const TodoAlerts = defineAlerts("planning", {
  TIMEZONE_REBASE_FAILED: {
    key: "planning.todo-timezone-rebase-failed",
    severity: "error",
    summary: "할 일 시간대 재계산이 재시도 뒤에도 실패해 알림이 옛 시간대로 울린다",
    runbook: "details.userId와 errorType으로 원인을 고친 뒤 그 사용자의 재계산 작업을 다시 넣는다.",
  },
});
