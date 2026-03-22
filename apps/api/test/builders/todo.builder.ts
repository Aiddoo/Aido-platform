/**
 * Todo 모델 테스트 데이터 빌더
 *
 * @example
 * ```typescript
 * // 기본 Todo
 * const todo = TodoBuilder.create('user-123').build();
 *
 * // 완료된 Todo
 * const completed = TodoBuilder.create('user-123').completed().build();
 *
 * // 비공개 Todo
 * const privateTodo = TodoBuilder.create('user-123').asPrivate().build();
 * ```
 */
import type { TodoWithCategory } from "@/modules/todo/types/todo.types";

export class TodoBuilder {
	private data: TodoWithCategory;
	private static idCounter = 0;

	private constructor(userId: string) {
		const now = new Date();
		TodoBuilder.idCounter += 1;
		this.data = {
			id: TodoBuilder.idCounter,
			userId,
			title: `테스트 할 일 ${TodoBuilder.idCounter}`,
			content: null,
			categoryId: 1,
			sortOrder: 0,
			startDate: now,
			endDate: null,
			scheduledTime: null,
			isAllDay: true,
			visibility: "PUBLIC",
			recurrenceGroupId: null,
			completed: false,
			completedAt: null,
			createdAt: now,
			updatedAt: now,
			category: {
				id: 1,
				name: "기본 카테고리",
				color: "#FFB3B3",
				sortOrder: 0,
			},
			items: [],
		};
	}

	static create(userId: string): TodoBuilder {
		return new TodoBuilder(userId);
	}

	/** ID 카운터 리셋 (테스트 간 격리용) */
	static resetIdCounter(): void {
		TodoBuilder.idCounter = 0;
	}

	// === ID 관련 ===

	withId(id: number): TodoBuilder {
		this.data.id = id;
		return this;
	}

	// === 제목/내용 관련 ===

	withTitle(title: string): TodoBuilder {
		this.data.title = title;
		return this;
	}

	withContent(content: string | null): TodoBuilder {
		this.data.content = content;
		return this;
	}

	// === 카테고리 관련 ===

	withCategoryId(categoryId: number): TodoBuilder {
		this.data.categoryId = categoryId;
		this.data.category.id = categoryId;
		return this;
	}

	withCategory(category: {
		id: number;
		name: string;
		color: string;
		sortOrder: number;
	}): TodoBuilder {
		this.data.categoryId = category.id;
		this.data.category = category;
		return this;
	}

	// === 일정 관련 ===

	withStartDate(date: Date): TodoBuilder {
		this.data.startDate = date;
		return this;
	}

	withEndDate(date: Date | null): TodoBuilder {
		this.data.endDate = date;
		return this;
	}

	withScheduledTime(time: Date | null): TodoBuilder {
		this.data.scheduledTime = time;
		return this;
	}

	withIsAllDay(isAllDay: boolean): TodoBuilder {
		this.data.isAllDay = isAllDay;
		return this;
	}

	withDateRange(startDate: Date, endDate: Date): TodoBuilder {
		this.data.startDate = startDate;
		this.data.endDate = endDate;
		return this;
	}

	// === 정렬 관련 ===

	withSortOrder(sortOrder: number): TodoBuilder {
		this.data.sortOrder = sortOrder;
		return this;
	}

	// === 공개 범위 관련 ===

	withVisibility(visibility: "PUBLIC" | "PRIVATE"): TodoBuilder {
		this.data.visibility = visibility;
		return this;
	}

	asPrivate(): TodoBuilder {
		this.data.visibility = "PRIVATE";
		return this;
	}

	asPublic(): TodoBuilder {
		this.data.visibility = "PUBLIC";
		return this;
	}

	// === 반복 생성 그룹 관련 ===

	withRecurrenceGroupId(groupId: string | null): TodoBuilder {
		this.data.recurrenceGroupId = groupId;
		return this;
	}

	// === 완료 상태 관련 ===

	completed(completedAt?: Date): TodoBuilder {
		this.data.completed = true;
		this.data.completedAt = completedAt ?? new Date();
		return this;
	}

	uncompleted(): TodoBuilder {
		this.data.completed = false;
		this.data.completedAt = null;
		return this;
	}

	// === 타임스탬프 관련 ===

	withCreatedAt(date: Date): TodoBuilder {
		this.data.createdAt = date;
		return this;
	}

	withUpdatedAt(date: Date): TodoBuilder {
		this.data.updatedAt = date;
		return this;
	}

	// === 빌드 ===

	build(): TodoWithCategory {
		return {
			...this.data,
			category: { ...this.data.category },
			items: [...this.data.items],
		};
	}

	/** 여러 개 생성 */
	static createMany(userId: string, count: number): TodoWithCategory[] {
		return Array.from({ length: count }, () =>
			TodoBuilder.create(userId).build(),
		);
	}
}
