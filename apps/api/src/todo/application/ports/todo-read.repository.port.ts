import type { Todo as TodoResponse } from "@aido/validators";
import type { FindFriendTodosParams, FindTodosParams } from "../types";

export const TODO_READ_REPOSITORY = Symbol("TODO_READ_REPOSITORY");

/**
 * Todo 읽기 리포지토리 포트 (조회 측)
 *
 * 쿼리 핸들러와 "쓰기 후 응답 조회"가 사용합니다. 애그리게잇을 거치지 않고
 * 응답 계약(`@aido/validators`의 Todo) read model을 직접 반환합니다(성능·계층 분리).
 */
export interface TodoReadRepositoryPort {
	findByIdAndUserId(id: number, userId: string): Promise<TodoResponse | null>;

	/** 반복 그룹 전체 조회 (sortOrder asc — 생성 순서와 동일) */
	findManyByRecurrenceGroupId(
		userId: string,
		recurrenceGroupId: string,
	): Promise<TodoResponse[]>;

	findManyByUserId(params: FindTodosParams): Promise<TodoResponse[]>;

	findPublicTodosByUserId(
		params: FindFriendTodosParams,
	): Promise<TodoResponse[]>;

	countActiveByCategory(userId: string, categoryId: number): Promise<number>;

	countCompletedByUser(userId: string): Promise<number>;

	getTodayTodoStats(
		userId: string,
		today: Date,
	): Promise<{ total: number; completed: number }>;
}
