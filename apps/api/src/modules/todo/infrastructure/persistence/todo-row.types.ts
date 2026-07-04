/**
 * Todo 영속성 행 타입 (Prisma 파생)
 *
 * 인프라 계층 전용 — application/domain에서 임포트하지 마세요.
 * (프레임워크 비의존 파라미터 타입은 application/types.ts 참조)
 */

import type { Prisma } from "@/generated/prisma/client";

/**
 * Todo 조회 시 포함할 카테고리·하위 항목 select 설정
 *
 * 모든 Todo 조회/생성/수정 메서드의 공통 include. 필드 변경 시 이 상수만 수정하면 반영됩니다.
 * 이 상수에서 `TodoWithCategory` 타입을 파생하므로 타입 단언(as) 없이 정합됩니다.
 */
export const TODO_CATEGORY_INCLUDE = {
	category: {
		select: { id: true, name: true, color: true, sortOrder: true },
	},
	items: {
		select: {
			id: true,
			title: true,
			completed: true,
			sortOrder: true,
			createdAt: true,
			updatedAt: true,
		},
		orderBy: { sortOrder: "asc" as const },
	},
} as const;

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
export type TodoWithCategory = Prisma.TodoGetPayload<{
	include: typeof TODO_CATEGORY_INCLUDE;
}>;
