import type { cheer as cheerTable } from "#api/platform/database/schema/index";

import { Cheer } from "../../domain/cheer.aggregate.js";

type CheerRow = typeof cheerTable.$inferSelect;
type CheerInsertRow = typeof cheerTable.$inferInsert;

export function toCheer(row: CheerRow): Cheer {
  return Cheer.reconstitute(row);
}

export function toCheerRow(cheer: Cheer): CheerInsertRow {
  return cheer.toPrimitives();
}
