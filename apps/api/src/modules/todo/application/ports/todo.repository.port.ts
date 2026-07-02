import type { TransactionClient } from "@/common/database";
import type { Prisma } from "@/generated/prisma/client";
import type { Todo } from "../../domain/entities/todo.entity";
import type {
	FindFriendTodosParams,
	FindTodosParams,
} from "../../types/todo.types";

export const TODO_REPOSITORY = Symbol("TODO_REPOSITORY");

/**
 * Todo 리포지토리 포트
 *
 * 애플리케이션(핸들러)이 Prisma 구현체에 의존하지 않도록 하는 경계입니다.
 * 조회 메서드는 도메인 애그리게잇(Todo)을 반환하고, 카운트/집계는 원시값을 반환합니다.
 * `tx?` 파라미터는 트랜잭션 클라이언트 전달용(기존 관례 유지)입니다.
 */
export interface TodoRepositoryPort {
	findByIdAndUserId(
		id: number,
		userId: string,
		tx?: TransactionClient,
	): Promise<Todo | null>;

	findManyByUserId(
		params: FindTodosParams,
		tx?: TransactionClient,
	): Promise<Todo[]>;

	findPublicTodosByUserId(
		params: FindFriendTodosParams,
		tx?: TransactionClient,
	): Promise<Todo[]>;

	create(data: Prisma.TodoCreateInput, tx?: TransactionClient): Promise<Todo>;

	/** 인라인 하위 항목 일괄 생성(생성 트랜잭션 내부에서 호출) */
	createInlineItems(
		todoId: number,
		items: { title: string }[],
		tx: TransactionClient,
	): Promise<void>;

	update(
		id: number,
		data: Prisma.TodoUpdateInput,
		tx?: TransactionClient,
	): Promise<Todo>;

	countActiveByCategory(
		userId: string,
		categoryId: number,
		tx?: TransactionClient,
	): Promise<number>;

	getMaxSortOrder(userId: string, tx?: TransactionClient): Promise<number>;

	countCompletedByUser(userId: string, tx?: TransactionClient): Promise<number>;

	getTodayTodoStats(
		userId: string,
		today: Date,
		tx?: TransactionClient,
	): Promise<{ total: number; completed: number }>;
}
