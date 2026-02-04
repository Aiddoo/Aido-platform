/**
 * Todo 테스트 Fixture
 *
 * 타입 안전한 Todo 및 관련 엔티티 테스트 데이터 생성
 */
import type {
	Todo,
	TodoCategory,
	TodoVisibility,
} from "@/generated/prisma/client";

let todoCounter = 0;
let categoryCounter = 0;

/**
 * TodoCategory Fixture 팩토리
 */
export const TodoCategoryFixture = {
	/**
	 * TodoCategory 엔티티 생성
	 */
	create: (overrides: Partial<TodoCategory> = {}): TodoCategory => {
		const id = ++categoryCounter;
		const now = new Date();

		return {
			id: overrides.id ?? id,
			userId: overrides.userId ?? `user-${id}`,
			name: overrides.name ?? `Category ${id}`,
			color: overrides.color ?? "#3B82F6",
			sortOrder: overrides.sortOrder ?? id,
			createdAt: overrides.createdAt ?? now,
			updatedAt: overrides.updatedAt ?? now,
		};
	},

	/**
	 * 여러 카테고리 생성
	 */
	createMany: (
		count: number,
		overrides: Partial<TodoCategory> = {},
	): TodoCategory[] => {
		return Array.from({ length: count }, () =>
			TodoCategoryFixture.create(overrides),
		);
	},

	/**
	 * 카운터 리셋
	 */
	reset: (): void => {
		categoryCounter = 0;
	},
};

/**
 * Todo Fixture 팩토리
 *
 * @example
 * ```typescript
 * // 기본 Todo 생성
 * const todo = TodoFixture.create({ userId: 'user-1', categoryId: 1 });
 *
 * // 완료된 Todo 생성
 * const completedTodo = TodoFixture.createCompleted({ userId: 'user-1', categoryId: 1 });
 *
 * // 여러 개 생성
 * const todos = TodoFixture.createMany(5, { userId: 'user-1', categoryId: 1 });
 * ```
 */
export const TodoFixture = {
	/**
	 * Todo 엔티티 생성
	 */
	create: (overrides: Partial<Todo> = {}): Todo => {
		const id = ++todoCounter;
		const now = new Date();

		return {
			id: overrides.id ?? id,
			userId: overrides.userId ?? `user-${id}`,
			categoryId: overrides.categoryId ?? id,
			title: overrides.title ?? `Test Todo ${id}`,
			content: overrides.content ?? `Test content for todo ${id}`,
			completed: overrides.completed ?? false,
			completedAt: overrides.completedAt ?? null,
			startDate: overrides.startDate ?? now,
			endDate: overrides.endDate ?? null,
			scheduledTime: overrides.scheduledTime ?? null,
			isAllDay: overrides.isAllDay ?? true,
			sortOrder: overrides.sortOrder ?? id,
			visibility: overrides.visibility ?? ("PRIVATE" as TodoVisibility),
			createdAt: overrides.createdAt ?? now,
			updatedAt: overrides.updatedAt ?? now,
		};
	},

	/**
	 * 완료된 Todo 생성
	 */
	createCompleted: (overrides: Partial<Todo> = {}): Todo => {
		const now = new Date();
		return TodoFixture.create({
			completed: true,
			completedAt: now,
			...overrides,
		});
	},

	/**
	 * 카테고리가 있는 Todo 생성
	 */
	createWithCategory: (
		todoOverrides: Partial<Todo> = {},
		categoryOverrides: Partial<TodoCategory> = {},
	): { todo: Todo; category: TodoCategory } => {
		const category = TodoCategoryFixture.create(categoryOverrides);
		const todo = TodoFixture.create({
			categoryId: category.id,
			userId: category.userId,
			...todoOverrides,
		});

		return { todo, category };
	},

	/**
	 * 여러 Todo 생성
	 */
	createMany: (count: number, overrides: Partial<Todo> = {}): Todo[] => {
		return Array.from({ length: count }, () => TodoFixture.create(overrides));
	},

	/**
	 * 카운터 리셋
	 */
	reset: (): void => {
		todoCounter = 0;
	},
};
