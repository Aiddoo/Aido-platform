import type { resourceBonus as resourceBonusTable } from "#api/platform/database/schema/access.schema";

import type { ResourceBonus } from "../../domain/resource-bonus.aggregate.js";

type ResourceBonusInsertRow = typeof resourceBonusTable.$inferInsert;

export function toResourceBonusRow(bonus: ResourceBonus): ResourceBonusInsertRow {
  return bonus.toPrimitives();
}
