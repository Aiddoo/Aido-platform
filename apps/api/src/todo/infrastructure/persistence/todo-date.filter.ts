import { all, and, or, type ModelAccessor } from "@prisma/orm-postgres/orm-client";

import { databaseDate } from "#api/shared/infrastructure/database/database-values";

import type { Contract } from "../../../generated/prisma8/contract.d.js";

/** Inclusive overlap. A single supplied boundary selects that exact calendar date. */
export function todoDatePredicate(
	todo: ModelAccessor<Contract, "Todo", "public">,
	startDate?: Date,
	endDate?: Date,
) {
	const effectiveStart = startDate ?? endDate;
	if (effectiveStart === undefined) return all();
	const start = databaseDate(effectiveStart);
	const end = databaseDate(endDate ?? effectiveStart);
	return or(
		and(todo.endDate.isNotNull(), todo.startDate.lte(end), todo.endDate.gte(start)),
		and(todo.endDate.isNull(), todo.startDate.gte(start), todo.startDate.lte(end)),
	);
}
