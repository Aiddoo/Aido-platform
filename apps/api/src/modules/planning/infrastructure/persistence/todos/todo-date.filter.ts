import { and, gte, isNotNull, isNull, lte, or, type SQL } from "drizzle-orm";

import { todo } from "#api/platform/database/schema/index";

/** Inclusive overlap. A single supplied boundary selects that exact calendar date. */
export function todoDateCondition(startDate?: Date, endDate?: Date): SQL | undefined {
  const start = startDate ?? endDate;
  if (start == null) {
    return undefined;
  }
  const end = endDate ?? start;
  return or(
    and(isNotNull(todo.endDate), lte(todo.startDate, end), gte(todo.endDate, start)),
    and(isNull(todo.endDate), gte(todo.startDate, start), lte(todo.startDate, end)),
  );
}
