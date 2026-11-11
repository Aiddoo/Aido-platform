import { defineAlerts } from "#api/shared/application/alerts/define-alerts";

export const TodoSeriesAlerts = defineAlerts("planning", {
  MATERIALIZE_FAILED: {
    key: "planning.todo-series.materialize-failed",
    severity: "error",
    summary: "반복 할 일 회차 채우기가 실패했거나 제한 시간 안에 끝나지 않았다",
    runbook:
      "details의 failedCount·timedOut과 planning.todo-series 로그를 본다. 다음 주기나 앱 열기 따라잡기가 채우는지 확인한다.",
  },
});
