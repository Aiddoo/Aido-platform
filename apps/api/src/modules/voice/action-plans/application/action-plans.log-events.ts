/** 말한 내용·제목은 남기지 않고 개수·길이·결과만 남긴다. */
export const ActionPlanLogEvent = {
  QUICK_PLAN_COMPLETED: "voice.quick-plan.completed",
  QUICK_PLAN_FAILED: "voice.quick-plan.failed",
  PLAN_APPLY_COMPLETED: "voice.plan-apply.completed",
  PLAN_APPLY_REPLAYED: "voice.plan-apply.replayed",
  PLAN_APPLICATION_PURGED: "voice.plan-application.purged",
  PLAN_APPLICATION_PURGE_FAILED: "voice.plan-application.purge-failed",
  PLAN_CLEANUP_SCHEDULER_REGISTERED: "voice.plan-application.scheduler-registered",
} as const;
