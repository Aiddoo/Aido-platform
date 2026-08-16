import type { Todo } from "@aido/validators";

import type { Prisma } from "@/generated/prisma/client";
import {
	toDateString,
	toDateStringOrNull,
	toISOString,
	toISOStringOrNull,
} from "@/shared/domain/date/utils/format";

export const TODO_DETAILS_INCLUDE = {
	category: true,
	items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
	user: { include: { profile: true } },
} satisfies Prisma.TodoInclude;

export type TodoDetailsRow = Prisma.TodoGetPayload<{ include: typeof TODO_DETAILS_INCLUDE }>;

export function toTodoResponse(row: TodoDetailsRow): Todo {
	const items = row.items.map((item) => ({
		id: item.id,
		title: item.title,
		completed: item.completed,
		sortOrder: item.sortOrder,
		createdAt: toISOString(item.createdAt),
		updatedAt: toISOString(item.updatedAt),
	}));

	return {
		id: row.id,
		userId: row.userId,
		title: row.title,
		content: null,
		sortOrder: row.sortOrder,
		completed: row.completed,
		completedAt: toISOStringOrNull(row.completedAt),
		startDate: toDateString(row.startDate),
		endDate: toDateStringOrNull(row.endDate),
		scheduledTime: toISOStringOrNull(row.scheduledTime),
		isAllDay: row.isAllDay,
		visibility: row.visibility,
		recurrenceGroupId: row.recurrenceGroupId,
		category: {
			id: row.category.id,
			name: row.category.name,
			color: row.category.color,
			sortOrder: row.category.sortOrder,
		},
		items,
		itemStats: {
			total: items.length,
			completed: items.filter((item) => item.completed).length,
		},
		commentCount: row.commentCount,
		createdAt: toISOString(row.createdAt),
		updatedAt: toISOString(row.updatedAt),
	};
}
