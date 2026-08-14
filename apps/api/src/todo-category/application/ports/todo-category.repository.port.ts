import type { TodoCategory } from "../../domain/entities/todo-category.aggregate";

/** 카테고리 + 할 일 개수 읽기 프로젝션 */
export interface TodoCategoryWithCountView {
	id: number;
	userId: string;
	name: string;
	color: string;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
	todoCount: number;
}

/** 카테고리 생성 입력 */
export interface CreateCategoryInput {
	userId: string;
	name: string;
	color: string;
	sortOrder: number;
}

/** 카테고리 갱신 입력 (이름/색상/정렬 부분 갱신) */
export interface UpdateCategoryInput {
	name?: string;
	color?: string;
	sortOrder?: number;
}

export const TODO_CATEGORY_REPOSITORY = Symbol("TODO_CATEGORY_REPOSITORY");

export interface TodoCategoryRepositoryPort {
	create(input: CreateCategoryInput): Promise<TodoCategory>;
	update(id: number, input: UpdateCategoryInput): Promise<TodoCategory>;
	delete(id: number): Promise<void>;

	findByIdAndUserId(id: number, userId: string): Promise<TodoCategory | null>;
	findByIdWithCount(id: number): Promise<TodoCategoryWithCountView | null>;
	findManyByUserId(userId: string): Promise<TodoCategoryWithCountView[]>;

	countByUserId(userId: string): Promise<number>;
	existsByUserIdAndName(
		userId: string,
		name: string,
		excludeId?: number,
	): Promise<boolean>;
	getMaxSortOrder(userId: string): Promise<number>;
	shiftSortOrders(
		userId: string,
		fromSortOrder: number,
		toSortOrder: number | null,
		delta: number,
	): Promise<number>;

	getTodoCount(categoryId: number): Promise<number>;
	moveTodosToCategory(
		fromCategoryId: number,
		toCategoryId: number,
	): Promise<number>;
}
