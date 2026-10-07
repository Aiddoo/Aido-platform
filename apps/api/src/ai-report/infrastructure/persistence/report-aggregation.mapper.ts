import { sumBy } from "es-toolkit";

import type { AggregationInputs, CategoryMetaRow, CompletedTodoRow } from "../../domain/types.js";

interface CountGroup {
	completed: boolean;
	count: number;
}

interface DailyCountGroup extends CountGroup {
	startDate: Date;
}

interface CategoryCountGroup extends CountGroup {
	categoryId: number;
}

/** DB의 복합 그룹을 기존 도메인 입력으로 변환한다. 빈 집계는 0을 유지한다. */
export function toAggregationInputs(
	daily: readonly DailyCountGroup[],
	previous: readonly CountGroup[],
	category: readonly CategoryCountGroup[],
	categories: CategoryMetaRow[],
	completedTodos: CompletedTodoRow[],
): AggregationInputs {
	const dailyTotals = new Map<number, { startDate: Date; _count: { id: number } }>();
	for (const row of daily) {
		const key = row.startDate.getTime();
		const existing = dailyTotals.get(key);
		if (existing !== undefined) {
			existing._count.id += row.count;
		} else {
			dailyTotals.set(key, { startDate: row.startDate, _count: { id: row.count } });
		}
	}

	const categoryTotals = new Map<number, { categoryId: number; _count: { id: number } }>();
	for (const row of category) {
		const existing = categoryTotals.get(row.categoryId);
		if (existing !== undefined) {
			existing._count.id += row.count;
		} else {
			categoryTotals.set(row.categoryId, { categoryId: row.categoryId, _count: { id: row.count } });
		}
	}

	return {
		dailyTotalGroups: [...dailyTotals.values()],
		dailyCompletedGroups: daily
			.filter((row) => row.completed)
			.map((row) => ({ startDate: row.startDate, _count: { id: row.count } })),
		prevTotalCount: sumBy(previous, (row) => row.count),
		prevCompletedCount: previous.find((row) => row.completed)?.count ?? 0,
		catTotalGroups: [...categoryTotals.values()],
		catCompletedGroups: category
			.filter((row) => row.completed)
			.map((row) => ({ categoryId: row.categoryId, _count: { id: row.count } })),
		categories,
		completedTodos,
	};
}
