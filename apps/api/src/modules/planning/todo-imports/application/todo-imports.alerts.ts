import { defineAlerts } from "#api/shared/application/alerts/define-alerts";

export const TodoImportAlerts = defineAlerts("planning", {
  JOB_FAILED: {
    key: "planning.todo-import.failed",
    severity: "error",
    summary: "캘린더 가져오기 작업이 재시도 뒤에도 실패해 가져오기를 FAILED로 멈췄다",
    runbook:
      "details.importId·queue·errorType과 같은 시각 jobs.job.failed 로그로 원인을 고친다. 만든 할 일과 센 수는 남아 있고, 사용자는 다시 가져오면 이미 만든 일정을 건너뛴다.",
  },
  STALLED: {
    key: "planning.todo-import.stalled",
    severity: "error",
    summary: "진행이 멈춘 캘린더 가져오기를 다시 넣어도 이어지지 않아 FAILED로 멈췄다",
    runbook:
      "details.importId의 큐 작업 상태(pg-boss)와 worker가 살아 있는지 본다. 원인을 고친 뒤 사용자는 다시 가져오면 된다.",
  },
});
