/**
 * Todo 애그리게잇 단위 테스트
 *
 * GWT 패턴 적용 — 완료 상태 전이 및 도메인 이벤트 적립 검증
 */

import { ErrorCode } from "@aido/errors";
import { DomainException } from "@/common/domain";
import { TodoCreatedEvent } from "../events/todo-created.event";
import { TodoRescheduledEvent } from "../events/todo-rescheduled.event";
import { TodoToggledEvent } from "../events/todo-toggled.event";
import { TodoUpdatedEvent } from "../events/todo-updated.event";
import { TodoId } from "../value-objects/todo-id.vo";
import { TodoSchedule } from "../value-objects/todo-schedule.vo";
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
		it("완료로 전환하면 true를 반환하고 completed=true, completedAt이 설정되며 TodoToggledEvent를 적립한다", () => {
			// Given - 미완료 상태의 할 일
			const todo = Todo.reconstitute(buildProps({ completed: false }));

			// When - 완료로 토글하면
			const changed = todo.toggleComplete(true, "Asia/Seoul");

			// Then - 상태가 완료로 전이되고 이벤트가 쌓인다
			expect(changed).toBe(true);
			expect(todo.isCompleted()).toBe(true);
			expect(todo.getCompletedAt()).toBeInstanceOf(Date);

			const events = todo.pullDomainEvents();
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
			const changed = todo.toggleComplete(false, "UTC");

			// Then - 상태가 미완료로 전이된다
			expect(changed).toBe(true);
			expect(todo.isCompleted()).toBe(false);
			expect(todo.getCompletedAt()).toBeNull();

			const event = todo.pullDomainEvents()[0];
			expect(event).toBeInstanceOf(TodoToggledEvent);
			if (event instanceof TodoToggledEvent) {
				expect(event.completed).toBe(false);
			}
		});

		it("같은 값으로 재토글하면 false를 반환하고 상태·이벤트 모두 변화가 없다 (스트릭/알림 재발화 억제)", () => {
			// Given - 이미 완료된 할 일 (completedAt 고정)
			const originalCompletedAt = new Date("2026-01-01T00:00:00.000Z");
			const todo = Todo.reconstitute(
				buildProps({ completed: true, completedAt: originalCompletedAt }),
			);

			// When - 동일 값(true)으로 재토글
			const changed = todo.toggleComplete(true, "UTC");

			// Then - 전이 없음 + completedAt 불변 + 이벤트 미적립
			expect(changed).toBe(false);
			expect(todo.isCompleted()).toBe(true);
			expect(todo.getCompletedAt()).toEqual(originalCompletedAt);
			expect(todo.pullDomainEvents()).toHaveLength(0);
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
			const events = todo.pullDomainEvents();
			expect(events).toHaveLength(1);

			const event = events[0];
			expect(event).toBeInstanceOf(TodoCreatedEvent);
			if (event instanceof TodoCreatedEvent) {
				expect(event.todoId).toBe(1);
				expect(event.scheduledTime).toEqual(scheduledTime);
			}
		});
	});

	describe("updateDetails", () => {
		it("정의된 필드만 변경하고 TodoUpdatedEvent를 적립한다", () => {
			// Given - 기존 할 일
			const todo = Todo.reconstitute(buildProps({ title: "이전 제목" }));

			// When - 제목만 부분 수정하면
			todo.updateDetails({ title: "새 제목" });

			// Then - 제목만 바뀌고 이벤트가 쌓인다 (completed는 미포함 → undefined)
			expect(todo.toPersistence().title).toBe("새 제목");

			const events = todo.pullDomainEvents();
			expect(events).toHaveLength(1);

			const event = events[0];
			expect(event).toBeInstanceOf(TodoUpdatedEvent);
			if (event instanceof TodoUpdatedEvent) {
				expect(event.todoId).toBe(1);
				expect(event.completed).toBeUndefined();
			}
		});

		it("빈 패치(모든 필드 undefined)면 상태 변화 없이 이벤트도 적립하지 않는다", () => {
			// Given - 기존 할 일
			const todo = Todo.reconstitute(buildProps({ title: "이전 제목" }));

			// When - 빈 패치로 수정 요청
			todo.updateDetails({});

			// Then - 상태·이벤트 모두 변화 없음
			expect(todo.toPersistence().title).toBe("이전 제목");
			expect(todo.pullDomainEvents()).toHaveLength(0);
		});

		it("미완료→완료 전이 시 completedAt을 설정한다", () => {
			// Given - 미완료 할 일
			const todo = Todo.reconstitute(buildProps({ completed: false }));

			// When
			todo.updateDetails({ completed: true });

			// Then
			expect(todo.isCompleted()).toBe(true);
			expect(todo.getCompletedAt()).toBeInstanceOf(Date);
		});

		it("완료→미완료 전이 시 completedAt을 null로 초기화한다", () => {
			// Given - 완료 할 일
			const todo = Todo.reconstitute(
				buildProps({ completed: true, completedAt: new Date() }),
			);

			// When
			todo.updateDetails({ completed: false });

			// Then
			expect(todo.isCompleted()).toBe(false);
			expect(todo.getCompletedAt()).toBeNull();
		});

		it("같은 완료 상태로 재요청하면 completedAt을 변경하지 않는다 (레거시 동작 보존)", () => {
			// Given - 이미 완료된 할 일 (completedAt 고정)
			const originalCompletedAt = new Date("2026-01-01T00:00:00.000Z");
			const todo = Todo.reconstitute(
				buildProps({ completed: true, completedAt: originalCompletedAt }),
			);

			// When - 동일 값(true)으로 재요청
			todo.updateDetails({ completed: true });

			// Then - completedAt 불변
			expect(todo.getCompletedAt()).toEqual(originalCompletedAt);
		});

		it("제목이 200자를 초과하면 DomainException을 던진다", () => {
			// Given
			const todo = Todo.reconstitute(buildProps());

			// When & Then - 도메인 불변식 위반
			expect(() => todo.updateDetails({ title: "가".repeat(201) })).toThrow(
				"제목은 1~200자여야 합니다.",
			);
		});

		it("endDate만 패치해도 저장된 startDate와 교차 검증해 역전이면 DomainException(SYS_0002)을 던진다", () => {
			// Given - startDate가 2026-02-22인 할 일
			const todo = Todo.reconstitute(
				buildProps({ startDate: new Date("2026-02-22") }),
			);
			const update = () =>
				todo.updateDetails({ endDate: new Date("2026-02-20") });

			// When & Then - 머지된 일정 불변식 위반 + 상태·이벤트 변화 없음
			expect(update).toThrow(DomainException);
			try {
				update();
			} catch (error) {
				if (error instanceof DomainException) {
					expect(error.errorCode).toBe(ErrorCode.SYS_0002);
				}
			}
			expect(todo.toPersistence().endDate).toBeNull();
			expect(todo.pullDomainEvents()).toHaveLength(0);
		});

		it("startDate만 패치해도 저장된 endDate와 교차 검증해 역전이면 어떤 필드도 변경하지 않는다 (부분 변경 방지)", () => {
			// Given - endDate가 2026-02-25인 할 일
			const todo = Todo.reconstitute(
				buildProps({ endDate: new Date("2026-02-25"), title: "이전 제목" }),
			);

			// When & Then - 제목과 함께 요청해도 검증 실패 시 아무것도 바뀌지 않는다
			expect(() =>
				todo.updateDetails({
					title: "새 제목",
					startDate: new Date("2026-03-01"),
				}),
			).toThrow(DomainException);
			expect(todo.toPersistence().title).toBe("이전 제목");
			expect(todo.toPersistence().startDate).toEqual(new Date("2026-02-22"));
		});
	});

	describe("reschedule", () => {
		it("일정을 변경하고 scheduledTime을 담은 TodoRescheduledEvent를 적립한다", () => {
			// Given - 종일 일정 할 일
			const todo = Todo.reconstitute(buildProps());
			const scheduledTime = new Date("2026-03-01T06:00:00.000Z");

			// When - 시간 일정으로 변경하면
			todo.reschedule(
				TodoSchedule.create({
					startDate: new Date("2026-03-01"),
					endDate: null,
					scheduledTime,
					isAllDay: false,
				}),
			);

			// Then - 이벤트에 새 scheduledTime이 실린다
			const event = todo.pullDomainEvents()[0];
			expect(event).toBeInstanceOf(TodoRescheduledEvent);
			if (event instanceof TodoRescheduledEvent) {
				expect(event.scheduledTime).toEqual(scheduledTime);
			}
		});

		it("scheduledTime 없이 변경하면 이벤트의 scheduledTime이 null이다 (리마인더 취소 트리거)", () => {
			// Given - 시간 일정이 있던 할 일
			const todo = Todo.reconstitute(
				buildProps({ scheduledTime: new Date(), isAllDay: false }),
			);

			// When - 종일 일정으로 변경
			todo.reschedule(
				TodoSchedule.create({
					startDate: new Date("2026-03-02"),
					endDate: null,
					scheduledTime: null,
					isAllDay: true,
				}),
			);

			// Then
			const event = todo.pullDomainEvents()[0];
			expect(event).toBeInstanceOf(TodoRescheduledEvent);
			if (event instanceof TodoRescheduledEvent) {
				expect(event.scheduledTime).toBeNull();
			}
		});
	});

	describe("changeVisibility / changeCategory", () => {
		it("공개 범위를 변경하고 이벤트는 적립하지 않는다", () => {
			// Given
			const todo = Todo.reconstitute(buildProps({ visibility: "PUBLIC" }));

			// When
			todo.changeVisibility("PRIVATE");

			// Then
			expect(todo.toPersistence().visibility).toBe("PRIVATE");
			expect(todo.pullDomainEvents()).toHaveLength(0);
		});

		it("카테고리를 변경하고 이벤트는 적립하지 않는다", () => {
			// Given
			const todo = Todo.reconstitute(buildProps({ categoryId: 1 }));

			// When
			todo.changeCategory(7);

			// Then
			expect(todo.toPersistence().categoryId).toBe(7);
			expect(todo.pullDomainEvents()).toHaveLength(0);
		});
	});

	describe("toPersistence", () => {
		it("가변 필드만 담은 저장용 스냅샷을 반환한다", () => {
			// Given
			const startDate = new Date("2026-02-22");
			const todo = Todo.reconstitute(buildProps({ title: "할 일", startDate }));

			// When
			const snapshot = todo.toPersistence();

			// Then - id/userId/sortOrder/items는 미포함
			expect(snapshot).toEqual({
				title: "할 일",
				categoryId: 1,
				startDate,
				endDate: null,
				scheduledTime: null,
				isAllDay: true,
				visibility: "PUBLIC",
				completed: false,
				completedAt: null,
			});
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
