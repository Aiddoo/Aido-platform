/**
 * Todo 애그리게잇 단위 테스트
 *
 * GWT 패턴 적용 — 완료 상태 전이 및 도메인 이벤트 적립 검증
 */

import type { TodoWithCategory } from "../../types/todo.types";
import { TodoCreatedEvent } from "../events/todo-created.event";
import { TodoToggledEvent } from "../events/todo-toggled.event";
import { Todo } from "./todo.entity";

function buildRow(overrides: Partial<TodoWithCategory> = {}): TodoWithCategory {
	return {
		id: 1,
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
		createdAt: new Date("2026-02-20T00:00:00.000Z"),
		updatedAt: new Date("2026-02-20T00:00:00.000Z"),
		category: { id: 1, name: "일반", color: "#FFFFFF", sortOrder: 0 },
		items: [],
		...overrides,
	};
}

describe("Todo — 할 일 애그리게잇", () => {
	describe("toggleComplete", () => {
		it("완료로 전환하면 completed=true, completedAt이 설정되고 TodoToggledEvent를 적립한다", () => {
			// Given - 미완료 상태의 할 일
			const todo = Todo.reconstitute(buildRow({ completed: false }));

			// When - 완료로 토글하면
			todo.toggleComplete(true, "Asia/Seoul");

			// Then - 상태가 완료로 전이되고 이벤트가 쌓인다
			expect(todo.isCompleted()).toBe(true);
			expect(todo.getSnapshot().completedAt).toBeInstanceOf(Date);

			const events = todo.getUncommittedEvents();
			expect(events).toHaveLength(1);
			expect(events[0]).toBeInstanceOf(TodoToggledEvent);
			const event = events[0] as TodoToggledEvent;
			expect(event.completed).toBe(true);
			expect(event.timezone).toBe("Asia/Seoul");
			expect(event.userId).toBe("user-123");
		});

		it("미완료로 전환하면 completed=false, completedAt이 null로 초기화된다", () => {
			// Given - 완료 상태의 할 일
			const todo = Todo.reconstitute(
				buildRow({ completed: true, completedAt: new Date() }),
			);

			// When - 미완료로 토글하면
			todo.toggleComplete(false, "UTC");

			// Then - 상태가 미완료로 전이된다
			expect(todo.isCompleted()).toBe(false);
			expect(todo.getSnapshot().completedAt).toBeNull();

			const event = todo.getUncommittedEvents()[0] as TodoToggledEvent;
			expect(event.completed).toBe(false);
		});
	});

	describe("markCreated", () => {
		it("scheduledTime 정보를 담은 TodoCreatedEvent를 적립한다", () => {
			// Given - scheduledTime이 있는 새 할 일
			const scheduledTime = new Date("2026-02-22T05:00:00.000Z");
			const todo = Todo.reconstitute(buildRow({ scheduledTime }));

			// When - 생성 완료를 표시하면
			todo.markCreated();

			// Then - 리마인더 트리거용 이벤트가 쌓인다
			const events = todo.getUncommittedEvents();
			expect(events).toHaveLength(1);
			expect(events[0]).toBeInstanceOf(TodoCreatedEvent);
			const event = events[0] as TodoCreatedEvent;
			expect(event.todoId).toBe(1);
			expect(event.scheduledTime).toEqual(scheduledTime);
		});
	});

	describe("getSnapshot", () => {
		it("매퍼/영속성용 스냅샷을 그대로 반환한다", () => {
			// Given - 특정 행으로 복원한 애그리게잇
			const row = buildRow({ title: "특정 제목" });
			const todo = Todo.reconstitute(row);

			// When - 스냅샷을 조회하면
			const snapshot = todo.getSnapshot();

			// Then - 원본 행과 동일하다
			expect(snapshot.title).toBe("특정 제목");
			expect(snapshot.category).toEqual(row.category);
		});
	});
});
