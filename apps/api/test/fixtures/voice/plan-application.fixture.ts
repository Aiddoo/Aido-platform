import {
  PlanApplication,
  type PlanApplicationPrimitives,
} from "#api/modules/voice/action-plans/domain/plan-application.aggregate";

export const PLAN_APPLICATION_FIXTURE_NOW = Temporal.Instant.from("2027-01-04T03:00:00Z");
export const PLAN_APPLICATION_FIXTURE_USER_ID = "clz7x5p8k0011qz0z8z8z8z8z";
export const PLAN_APPLICATION_FIXTURE_OTHER_USER_ID = "clz7x5p8k0012qz0z8z8z8z8z";

export function createPlanApplicationFixture(
  overrides: Partial<PlanApplicationPrimitives> = {},
): PlanApplication {
  return PlanApplication.reconstitute({
    id: "cplanapplication0000000001",
    userId: PLAN_APPLICATION_FIXTURE_USER_ID,
    idempotencyKey: "apply-key-1",
    requestHash: "a".repeat(64),
    source: "QUICK_VOICE",
    todoIds: [101, 102],
    memoId: 7,
    createdAt: PLAN_APPLICATION_FIXTURE_NOW,
    ...overrides,
  });
}
