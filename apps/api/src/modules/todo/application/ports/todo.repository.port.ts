import type { TransactionClient } from "@/common/database";
import type {
	Todo,
	TodoDetailsPatch,
	TodoVisibility,
} from "../../domain/entities/todo.entity";
import type { TodoScheduleProps } from "../../domain/value-objects/todo-schedule.vo";

export const TODO_REPOSITORY = Symbol("TODO_REPOSITORY");

/**
 * Todo 부분 수정 영속화 패치
 *
 * 도메인 패치에 전이로 파생된 completedAt을 더한 형태입니다.
 * undefined 필드는 변경하지 않습니다(Prisma partial update 시맨틱).
 */
export type TodoUpdatePatch = TodoDetailsPatch & {
	completedAt?: Date | null;
};

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

	/** 부분 수정 패치 영속화 (undefined 필드는 미변경) */
	updateDetails(
		id: number,
		patch: TodoUpdatePatch,
		tx?: TransactionClient,
	): Promise<void>;

	updateTitle(id: number, title: string, tx?: TransactionClient): Promise<void>;

	updateVisibility(
		id: number,
		visibility: TodoVisibility,
		tx?: TransactionClient,
	): Promise<void>;

	updateSchedule(
		id: number,
		schedule: TodoScheduleProps,
		tx?: TransactionClient,
	): Promise<void>;

	updateCategory(
		id: number,
		categoryId: number,
		tx?: TransactionClient,
	): Promise<void>;

	delete(id: number, tx?: TransactionClient): Promise<void>;

	updateSortOrder(
		id: number,
		sortOrder: number,
		tx?: TransactionClient,
	): Promise<void>;

	/**
	 * [from, to] 범위(둘 다 포함)의 sortOrder를 delta만큼 일괄 이동.
	 * to가 null이면 from 이상 전체.
	 */
	shiftSortOrders(
		userId: string,
		from: number,
		to: number | null,
		delta: number,
		tx?: TransactionClient,
	): Promise<void>;

	countActiveByCategory(
		userId: string,
		categoryId: number,
		tx?: TransactionClient,
	): Promise<number>;

	getMaxSortOrder(userId: string, tx?: TransactionClient): Promise<number>;

	// ===== 하위 항목 (체크리스트) =====

	countItemsByTodoId(todoId: number, tx?: TransactionClient): Promise<number>;

	getMaxItemSortOrder(todoId: number, tx?: TransactionClient): Promise<number>;

	createItem(
		todoId: number,
		data: { title: string; sortOrder: number },
		tx?: TransactionClient,
	): Promise<void>;

	updateItem(
		itemId: number,
		data: { title?: string; completed?: boolean },
		tx?: TransactionClient,
	): Promise<void>;

	deleteItem(itemId: number, tx?: TransactionClient): Promise<void>;

	/** 배열 인덱스가 새 sortOrder가 되도록 일괄 재정렬 */
	reorderItems(itemIds: number[], tx?: TransactionClient): Promise<void>;
}
