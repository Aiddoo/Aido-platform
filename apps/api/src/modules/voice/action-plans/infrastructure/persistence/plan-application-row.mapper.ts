import type { planApplication as planApplicationTable } from "#api/platform/database/schema/voice.schema";

import { PlanApplication } from "../../domain/plan-application.aggregate.js";

type PlanApplicationRow = typeof planApplicationTable.$inferSelect;
type PlanApplicationInsertRow = typeof planApplicationTable.$inferInsert;

export function toPlanApplication(row: PlanApplicationRow): PlanApplication {
  return PlanApplication.reconstitute(row);
}

export function toPlanApplicationRow(application: PlanApplication): PlanApplicationInsertRow {
  const primitives = application.toPrimitives();
  return { ...primitives, todoIds: [...primitives.todoIds] };
}
