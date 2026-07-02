/**
 * Todo 애그리게잇 단위 테스트
 *
 * GWT 패턴 적용 — 완료 상태 전이 및 도메인 이벤트 적립 검증
 */

import { TodoCreatedEvent } from "../events/todo-created.event";
import { TodoToggledEvent } from "../events/todo-toggled.event";
import { TodoId } from "../value-objects/todo-id.vo";
import { Todo, type TodoProps } from "./todo.entity";

function buildProps(overrides: Partial<TodoProps> = {}): TodoProps {
	return {
		id: TodoId.create(1),
		userId: "user-123",
		title: "할 일",
		categoryId: 1,
		sortOrder: 0,
		completed: false,
		completedAt: null,
		startDate: new Date("2026-02-22"),
		endDate: null,
		scheduledTime: null,
		isAllDay: true,
		visibility: "PUBLIC",
		recurrenceGroupId: null,
		items: [],
		createdAt: new Date("2026-02-20T00:00:00.000Z"),
		updatedAt: new Date("2026-02-20T00:00:00.000Z"),
		...overrides,
	};
}

describe("Todo — 할 일 애그리게잇", () => {
	describe("toggleComplete", () => {
		it("완료로 전환하면 completed=true, completedAt이 설정되고 TodoToggledEvent를 적립한다", () => {
			// Given - 미완료 상태의 할 일
			const todo = Todo.reconstitute(buildProps({ completed: false }));

			// When - 완료로 토글하면
			todo.toggleComplete(true, "Asia/Seoul");

			// Then - 상태가 완료로 전이되고 이벤트가 쌓인다
			expect(todo.isCompleted()).toBe(true);
			expect(todo.getCompletedAt()).toBeInstanceOf(Date);

			const events = todo.getUncommittedEvents();
			expect(events).toHaveLength(1);

			const event = events[0];
			expect(event).toBeInstanceOf(TodoToggledEvent);
			if (event instanceof TodoToggledEvent) {
				expect(event.completed).toBe(true);
				expect(event.timezone).toBe("Asia/Seoul");
				expect(event.userId).toBe("user-123");
			}
		});

		it("미완료로 전환하면 completed=false, completedAt이 null로 초기화된다", () => {
			// Given - 완료 상태의 할 일
			const todo = Todo.reconstitute(
				buildProps({ completed: true, completedAt: new Date() }),
			);

			// When - 미완료로 토글하면
			todo.toggleComplete(false, "UTC");

			// Then - 상태가 미완료로 전이된다
			expect(todo.isCompleted()).toBe(false);
			expect(todo.getCompletedAt()).toBeNull();

			const event = todo.getUncommittedEvents()[0];
			expect(event).toBeInstanceOf(TodoToggledEvent);
			if (event instanceof TodoToggledEvent) {
				expect(event.completed).toBe(false);
			}
		});
	});

	describe("markCreated", () => {
		it("scheduledTime 정보를 담은 TodoCreatedEvent를 적립한다", () => {
			// Given - scheduledTime이 있는 새 할 일
			const scheduledTime = new Date("2026-02-22T05:00:00.000Z");
			const todo = Todo.reconstitute(buildProps({ scheduledTime }));

			// When - 생성 완료를 표시하면
			todo.markCreated();

			// Then - 리마인더 트리거용 이벤트가 쌓인다
			const events = todo.getUncommittedEvents();
			expect(events).toHaveLength(1);

			const event = events[0];
			expect(event).toBeInstanceOf(TodoCreatedEvent);
			if (event instanceof TodoCreatedEvent) {
				expect(event.todoId).toBe(1);
				expect(event.scheduledTime).toEqual(scheduledTime);
			}
		});
	});

	describe("getId", () => {
		it("TodoId 값 객체로 식별자를 반환한다", () => {
			// Given - 특정 id로 복원한 애그리게잇
			const todo = Todo.reconstitute(buildProps({ id: TodoId.create(42) }));

			// When / Then - 식별자 값을 반환한다
			expect(todo.getId().getValue()).toBe(42);
			expect(todo.getUserId()).toBe("user-123");
		});
	});
});
