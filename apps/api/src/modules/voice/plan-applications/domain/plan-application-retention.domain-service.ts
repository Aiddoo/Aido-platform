import { PLAN_APPLICATION_RETENTION_DAYS } from "./plan-applications.constants.js";

export function planApplicationRetentionCutoff(now: Temporal.Instant): Temporal.Instant {
  return now.subtract({ hours: PLAN_APPLICATION_RETENTION_DAYS * 24 });
}
