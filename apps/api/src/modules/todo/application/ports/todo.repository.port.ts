import type { TransactionClient } from "@/common/database";
import type { Todo, TodoVisibility } from "../../domain/entities/todo.entity";

export const TODO_REPOSITORY = Symbol("TODO_REPOSITORY");

/**
 * 신규 Todo 영속화 입력 (도메인 관점)
 *
 * Prisma 관계 connect 등 영속성 세부는 어댑터가 담당하므로 포트는 순수 데이터만 받습니다.
 */
export interface NewTodoData {
	userId: string;
	categoryId: number;
	title: string;
	sortOrder: number;
	startDate: Date;
	endDate?: Date | null;
	scheduledTime?: Date | null;
	isAllDay: boolean;
	visibility: TodoVisibility;
}

/**
 * Todo 쓰기 리포지토리 포트 (애그리게잇 경계)
 *
 * 커맨드 핸들러가 Prisma 구현체에 의존하지 않도록 하는 쓰기 측 경계입니다.
 * 조회는 애그리게잇(Todo)을 반환하고, 응답 read model은 TodoReadRepositoryPort가 담당합니다.
 */
export interface TodoRepositoryPort {
	findByIdAndUserId(
		id: number,
		userId: string,
		tx?: TransactionClient,
	): Promise<Todo | null>;

	create(data: NewTodoData, tx?: TransactionClient): Promise<Todo>;

	/** 인라인 하위 항목 일괄 생성(생성 트랜잭션 내부에서 호출) */
	createInlineItems(
		todoId: number,
		items: { title: string }[],
		tx: TransactionClient,
	): Promise<void>;

	/** 완료 상태 등 애그리게잇 변경분 영속화 */
	updateCompletion(
		id: number,
		completed: boolean,
		completedAt: Date | null,
		tx?: TransactionClient,
	): Promise<void>;

	countActiveByCategory(
		userId: string,
		categoryId: number,
		tx?: TransactionClient,
	): Promise<number>;

	getMaxSortOrder(userId: string, tx?: TransactionClient): Promise<number>;
}
