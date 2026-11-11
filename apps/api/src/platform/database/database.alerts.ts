import { defineAlerts } from "#api/shared/application/alerts/define-alerts";

export const DatabaseAlerts = defineAlerts("database", {
  UNIQUE_CONSTRAINT_UNKNOWN: {
    key: "database.unique-constraint.unknown",
    severity: "warning",
    summary: "저장소가 번역하지 않은 unique 충돌을 409 SYS_0004로 돌려줬다",
    runbook:
      "태그 constraint를 가진 저장소에 isUniqueConstraintViolation 번역을 더해 업무 오류로 바꾼다.",
  },
});
