import type { TransactionContext } from "@/common/database";
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
		tx?: TransactionContext,
	): Promise<Todo | null>;

	create(data: NewTodoData, tx?: TransactionContext): Promise<Todo>;

	/** 인라인 하위 항목 일괄 생성(생성 트랜잭션 내부에서 호출) */
	createInlineItems(
		todoId: number,
		items: { title: string }[],
		tx: TransactionContext,
	): Promise<void>;

	/** 완료 상태 등 애그리게잇 변경분 영속화 */
	updateCompletion(
		id: number,
		completed: boolean,
		completedAt: Date | null,
		tx?: TransactionContext,
	): Promise<void>;

	/** 부분 수정 패치 영속화 (undefined 필드는 미변경) */
	updateDetails(
		id: number,
		patch: TodoUpdatePatch,
		tx?: TransactionContext,
	): Promise<void>;

	updateTitle(
		id: number,
		title: string,
		tx?: TransactionContext,
	): Promise<void>;

	updateVisibility(
		id: number,
		visibility: TodoVisibility,
		tx?: TransactionContext,
	): Promise<void>;

	updateSchedule(
		id: number,
		schedule: TodoScheduleProps,
		tx?: TransactionContext,
	): Promise<void>;

	updateCategory(
		id: number,
		categoryId: number,
		tx?: TransactionContext,
	): Promise<void>;

	delete(id: number, tx?: TransactionContext): Promise<void>;

	updateSortOrder(
		id: number,
		sortOrder: number,
		tx?: TransactionContext,
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
		tx?: TransactionContext,
	): Promise<void>;

	/**
	 * 반복 그룹 일괄 생성 — 생성된 애그리게잇을 sortOrder 순으로 반환.
	 * 다중 쓰기이므로 트랜잭션 필수.
	 */
	createMany(
		items: NewTodoData[],
		recurrenceGroupId: string,
		tx: TransactionContext,
	): Promise<Todo[]>;

	countActiveByCategory(
		userId: string,
		categoryId: number,
		tx?: TransactionContext,
	): Promise<number>;

	getMaxSortOrder(userId: string, tx?: TransactionContext): Promise<number>;

	// ===== 하위 항목 (체크리스트) =====

	countItemsByTodoId(todoId: number, tx?: TransactionContext): Promise<number>;

	getMaxItemSortOrder(todoId: number, tx?: TransactionContext): Promise<number>;

	createItem(
		todoId: number,
		data: { title: string; sortOrder: number },
		tx?: TransactionContext,
	): Promise<void>;

	updateItem(
		itemId: number,
		data: { title?: string; completed?: boolean },
		tx?: TransactionContext,
	): Promise<void>;

	deleteItem(itemId: number, tx?: TransactionContext): Promise<void>;

	/** 배열 인덱스가 새 sortOrder가 되도록 일괄 재정렬 */
	reorderItems(itemIds: number[], tx?: TransactionContext): Promise<void>;
}
