import type { Todo } from "@aido/validators";

import {
	toDateString,
	toDateStringOrNull,
	toISOString,
	toISOStringOrNull,
} from "#api/shared/domain/date/utils/format";
import type { DatabaseRecord } from "#api/shared/infrastructure/database/database-records";
import { requireRecord } from "#api/shared/infrastructure/database/prisma-error.util";

export type TodoDetailsRow = DatabaseRecord<"Todo"> & {
	category: DatabaseRecord<"TodoCategory"> | null;
	items: DatabaseRecord<"TodoItem">[];
	user: (DatabaseRecord<"User"> & { profile: DatabaseRecord<"UserProfile"> | null }) | null;
};

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
			id: requireRecord(row.category).id,
			name: requireRecord(row.category).name,
			color: requireRecord(row.category).color,
			sortOrder: requireRecord(row.category).sortOrder,
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
