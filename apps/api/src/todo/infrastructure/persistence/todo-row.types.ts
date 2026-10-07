/**
 * Todo 영속성 행 타입 (Prisma 파생)
 *
 * 인프라 계층 전용 — application/domain에서 임포트하지 마세요.
 * (프레임워크 비의존 파라미터 타입은 application/types.ts 참조)
 */

import type { Todo, TodoCategory } from "#api/shared/infrastructure/database/database.types";

/** 쓰기 aggregate에 필요한 하위 항목만 조회한다. */
export const TODO_ITEMS_INCLUDE = {
	items: {
		select: {
			id: true,
			title: true,
			completed: true,
			sortOrder: true,
			createdAt: true,
			updatedAt: true,
		},
		orderBy: { sortOrder: "asc" },
	},
};

/** 공개 읽기 응답은 기존 카테고리 projection을 유지한다. */
export const TODO_CATEGORY_INCLUDE = {
	category: { select: { id: true, name: true, color: true, sortOrder: true } },
	...TODO_ITEMS_INCLUDE,
};

export type TodoAggregateRow = Todo & { items: TodoItemData[] };

/**
 * 하위 항목 행 데이터
 */
export interface TodoItemData {
	id: number;
	title: string;
	completed: boolean;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * 카테고리·하위 항목이 포함된 Todo 행 (행 리포지토리 반환 타입)
 *
 * `TODO_CATEGORY_INCLUDE`에서 파생 — Prisma 결과와 정확히 일치하므로 `as` 단언이 불필요합니다.
 */
export type TodoWithCategory = TodoAggregateRow & {
	category: Pick<TodoCategory, "id" | "name" | "color" | "sortOrder"> | null;
};
