/**
 * TodoCategory 모델 테스트 데이터 빌더
 *
 * @example
 * ```typescript
 * // 기본 카테고리
 * const category = TodoCategoryBuilder.create('user-123').build();
 *
 * // 커스텀 카테고리
 * const important = TodoCategoryBuilder.create('user-123')
 *   .withName('중요한 일')
 *   .withColor('#FF6B43')
 *   .build();
 * ```
 */
import type { TodoCategory } from "@/generated/prisma/client";

export interface TodoCategoryWithCount extends TodoCategory {
	_count: {
		todos: number;
	};
}

export class TodoCategoryBuilder {
	private data: TodoCategory;
	private todoCount: number = 0;
	private static idCounter = 0;

	private constructor(userId: string) {
		const now = new Date();
		TodoCategoryBuilder.idCounter += 1;
		this.data = {
			id: TodoCategoryBuilder.idCounter,
			userId,
			name: `카테고리 ${TodoCategoryBuilder.idCounter}`,
			color: "#FFB3B3",
			sortOrder: 0,
			createdAt: now,
			updatedAt: now,
		};
	}

	static create(userId: string): TodoCategoryBuilder {
		return new TodoCategoryBuilder(userId);
	}

	/** ID 카운터 리셋 (테스트 간 격리용) */
	static resetIdCounter(): void {
		TodoCategoryBuilder.idCounter = 0;
	}

	// === ID 관련 ===

	withId(id: number): TodoCategoryBuilder {
		this.data.id = id;
		return this;
	}

	// === 이름/색상 관련 ===

	withName(name: string): TodoCategoryBuilder {
		this.data.name = name;
		return this;
	}

	withColor(color: string): TodoCategoryBuilder {
		this.data.color = color;
		return this;
	}

	// === 정렬 관련 ===

	withSortOrder(sortOrder: number): TodoCategoryBuilder {
		this.data.sortOrder = sortOrder;
		return this;
	}

	// === 타임스탬프 관련 ===

	withCreatedAt(date: Date): TodoCategoryBuilder {
		this.data.createdAt = date;
		return this;
	}

	withUpdatedAt(date: Date): TodoCategoryBuilder {
		this.data.updatedAt = date;
		return this;
	}

	// === Todo 개수 관련 ===

	withTodoCount(count: number): TodoCategoryBuilder {
		this.todoCount = count;
		return this;
	}

	// === 빌드 ===

	build(): TodoCategory {
		return { ...this.data };
	}

	/** Todo 개수 포함 빌드 */
	buildWithCount(): TodoCategoryWithCount {
		return {
			...this.data,
			_count: { todos: this.todoCount },
		};
	}

	/** 여러 개 생성 */
	static createMany(userId: string, count: number): TodoCategory[] {
		return Array.from({ length: count }, () => TodoCategoryBuilder.create(userId).build());
	}
}
