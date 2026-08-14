/**
 * Todo 애그리게잇 단위 테스트
 *
 * GWT 패턴 적용 — 완료 상태 전이·생성 계획·하위 항목 불변식·도메인 이벤트 적립 검증
 */

import { ErrorCode } from "@aido/errors";
import { TODO_ITEM_LIMITS } from "@aido/validators";

import { DomainException } from "@/shared/domain";

import { TodoCategoryChangedEvent } from "../events/todo-category-changed.event";
import { TodoCreatedEvent } from "../events/todo-created.event";
import { TodoRescheduledEvent } from "../events/todo-rescheduled.event";
import { TodoToggledEvent } from "../events/todo-toggled.event";
import { TodoUpdatedEvent } from "../events/todo-updated.event";
import { TodoVisibilityChangedEvent } from "../events/todo-visibility-changed.event";
import { TodoId } from "../value-objects/todo-id.vo";
import { TodoSchedule, type TodoScheduleProps } from "../value-objects/todo-schedule.vo";
import { TodoItem } from "./todo-item.entity";
import { Todo, type TodoProps } from "./todo.aggregate";

function buildSchedule(overrides: Partial<TodoScheduleProps> = {}): TodoSchedule {
	return TodoSchedule.reconstitute({
		startDate: new Date("2026-02-22"),
		endDate: null,
		scheduledTime: null,
		isAllDay: true,
		...overrides,
	});
}

function buildItem(id: number, sortOrder: number): TodoItem {
	return TodoItem.reconstitute({
		id,
		title: `항목 ${id}`,
		completed: false,
		sortOrder,
		createdAt: new Date("2026-02-20T00:00:00.000Z"),
		updatedAt: new Date("2026-02-20T00:00:00.000Z"),
	});
}

function buildProps(overrides: Partial<TodoProps> = {}): TodoProps {
	return {
		id: TodoId.create(1),
		userId: "user-123",
		title: "할 일",
		categoryId: 1,
		sortOrder: 0,
		completed: false,
		completedAt: null,
		schedule: buildSchedule(),
		visibility: "PUBLIC",
		recurrenceGroupId: null,
		items: [],
		createdAt: new Date("2026-02-20T00:00:00.000Z"),
		updatedAt: new Date("2026-02-20T00:00:00.000Z"),
		...overrides,
	};
}

describe("Todo — 할 일 애그리게잇", () => {
	describe("planCreation", () => {
		it("isAllDay·visibility 미지정 시 기본값(true, PUBLIC)을 파생한다", () => {
			// Given & When - 최소 입력으로 생성 계획
			const draft = Todo.planCreation({
				userId: "user-123",
				categoryId: 1,
				title: "새 할 일",
				startDate: new Date("2026-02-22"),
			});

			// Then - 기본값 파생 + 입력 보존, sortOrder는 미포함(핸들러가 TX 안에서 결정)
			expect(draft).toEqual({
				userId: "user-123",
				categoryId: 1,
				title: "새 할 일",
				startDate: new Date("2026-02-22"),
				endDate: undefined,
				scheduledTime: undefined,
				isAllDay: true,
				visibility: "PUBLIC",
			});
			expect(draft).not.toHaveProperty("sortOrder");
		});

		it("isAllDay·visibility를 지정하면 그 값을 그대로 사용한다", () => {
			// Given & When
			const scheduledTime = new Date("2026-02-22T09:00:00.000Z");
			const draft = Todo.planCreation({
				userId: "user-123",
				categoryId: 1,
				title: "새 할 일",
				startDate: new Date("2026-02-22"),
				scheduledTime,
				isAllDay: false,
				visibility: "PRIVATE",
			});

			// Then
			expect(draft.isAllDay).toBe(false);
			expect(draft.visibility).toBe("PRIVATE");
			expect(draft.scheduledTime).toEqual(scheduledTime);
		});

		it("endDate가 startDate보다 빠르면 DomainException(SYS_0002)을 던진다 (생성 시 일정 불변식)", () => {
			// Given
			const plan = () =>
				Todo.planCreation({
					userId: "user-123",
					categoryId: 1,
					title: "정상 제목",
					startDate: new Date("2026-02-22"),
					endDate: new Date("2026-02-20"),
				});

			// When & Then
			expect(plan).toThrow(DomainException);
			expect(plan).toThrow("종료 날짜는 시작 날짜보다 빠를 수 없습니다.");
		});

		it("제목이 200자를 초과하면 DomainException(SYS_0002)을 던진다 (생성 불변식 단일 지점)", () => {
			// Given
			const plan = () =>
				Todo.planCreation({
					userId: "user-123",
					categoryId: 1,
					title: "가".repeat(201),
					startDate: new Date("2026-02-22"),
				});

			// When & Then
			expect(plan).toThrow(DomainException);
			try {
				plan();
			} catch (error) {
				if (error instanceof DomainException) {
					expect(error.errorCode).toBe(ErrorCode.SYS_0002);
				}
			}
		});
	});

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
			const todo = Todo.reconstitute(buildProps({ completed: true, completedAt: new Date() }));

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
			const todo = Todo.reconstitute(
				buildProps({
					schedule: buildSchedule({ scheduledTime, isAllDay: false }),
				}),
			);

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
		it("정의된 필드만 변경하고 전이 후 완료 상태를 담은 TodoUpdatedEvent를 적립한다", () => {
			// Given - 기존 미완료 할 일
			const todo = Todo.reconstitute(buildProps({ title: "이전 제목" }));

			// When - 제목만 부분 수정하면
			todo.updateDetails({ title: "새 제목" });

			// Then - 제목만 바뀌고 이벤트에는 전이 후 완료 상태(false, 사실)가 실린다
			expect(todo.toPersistence().title).toBe("새 제목");

			const events = todo.pullDomainEvents();
			expect(events).toHaveLength(1);

			const event = events[0];
			expect(event).toBeInstanceOf(TodoUpdatedEvent);
			if (event instanceof TodoUpdatedEvent) {
				expect(event.todoId).toBe(1);
				expect(event.completed).toBe(false);
			}
		});

		it("완료 상태인 할 일의 제목만 수정해도 이벤트 completed는 true다 (명령 에코가 아닌 사실)", () => {
			// Given - 완료 상태의 할 일
			const todo = Todo.reconstitute(buildProps({ completed: true, completedAt: new Date() }));

			// When - 완료 필드 없이 제목만 수정
			todo.updateDetails({ title: "새 제목" });

			// Then - 이벤트에는 전이 후 완료 상태(true)가 실린다
			const event = todo.pullDomainEvents()[0];
			expect(event).toBeInstanceOf(TodoUpdatedEvent);
			if (event instanceof TodoUpdatedEvent) {
				expect(event.completed).toBe(true);
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
			const todo = Todo.reconstitute(buildProps({ completed: true, completedAt: new Date() }));

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
				buildProps({
					schedule: buildSchedule({ startDate: new Date("2026-02-22") }),
				}),
			);
			const update = () => todo.updateDetails({ endDate: new Date("2026-02-20") });

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
				buildProps({
					title: "이전 제목",
					schedule: buildSchedule({ endDate: new Date("2026-02-25") }),
				}),
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
				buildProps({
					schedule: buildSchedule({
						scheduledTime: new Date(),
						isAllDay: false,
					}),
				}),
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
		it("공개 범위를 변경하고 TodoVisibilityChangedEvent를 적립한다", () => {
			// Given
			const todo = Todo.reconstitute(
				buildProps({
					id: TodoId.create(3),
					userId: "user-1",
					visibility: "PUBLIC",
				}),
			);

			// When
			todo.changeVisibility("PRIVATE");

			// Then
			expect(todo.toPersistence().visibility).toBe("PRIVATE");
			const event = todo.pullDomainEvents()[0];
			expect(event).toBeInstanceOf(TodoVisibilityChangedEvent);
			if (event instanceof TodoVisibilityChangedEvent) {
				expect(event.todoId).toBe(3);
				expect(event.userId).toBe("user-1");
			}
		});

		it("카테고리를 변경하고 TodoCategoryChangedEvent를 적립한다 (일별 완료 색상 집계 캐시 무효화)", () => {
			// Given
			const todo = Todo.reconstitute(
				buildProps({ id: TodoId.create(3), userId: "user-1", categoryId: 1 }),
			);

			// When
			todo.changeCategory(7);

			// Then
			expect(todo.toPersistence().categoryId).toBe(7);
			const event = todo.pullDomainEvents()[0];
			expect(event).toBeInstanceOf(TodoCategoryChangedEvent);
			if (event instanceof TodoCategoryChangedEvent) {
				expect(event.todoId).toBe(3);
				expect(event.userId).toBe("user-1");
				expect(event.categoryId).toBe(7);
			}
		});
	});

	describe("planItemAddition", () => {
		it("보유 항목의 최대 sortOrder + 1로 추가 계획을 반환한다", () => {
			// Given - sortOrder 0, 3 항목 보유 (구멍이 있어도 max 기준)
			const todo = Todo.reconstitute(buildProps({ items: [buildItem(10, 0), buildItem(11, 3)] }));

			// When
			const plan = todo.planItemAddition("새 항목");

			// Then
			expect(plan).toEqual({ title: "새 항목", sortOrder: 4 });
		});

		it("항목이 없으면 sortOrder 0으로 계획한다", () => {
			// Given
			const todo = Todo.reconstitute(buildProps({ items: [] }));

			// When
			const plan = todo.planItemAddition("첫 항목");

			// Then
			expect(plan).toEqual({ title: "첫 항목", sortOrder: 0 });
		});

		it("항목 수가 MAX_PER_TODO에 도달하면 DomainException(TODO_0821)을 상세 정보와 함께 던진다", () => {
			// Given - 한도까지 채운 항목
			const fullItems = Array.from({ length: TODO_ITEM_LIMITS.MAX_PER_TODO }, (_, index) =>
				buildItem(index + 1, index),
			);
			const todo = Todo.reconstitute(buildProps({ items: fullItems }));
			const plan = () => todo.planItemAddition("초과 항목");

			// When & Then - 에러 코드·details 보존
			expect(plan).toThrow(DomainException);
			try {
				plan();
			} catch (error) {
				if (error instanceof DomainException) {
					expect(error.errorCode).toBe(ErrorCode.TODO_0821);
					expect(error.details).toEqual({
						currentCount: TODO_ITEM_LIMITS.MAX_PER_TODO,
						maxPerTodo: TODO_ITEM_LIMITS.MAX_PER_TODO,
					});
				}
			}
		});

		it("제목이 200자를 초과하면 DomainException(SYS_0002)을 던진다", () => {
			// Given
			const todo = Todo.reconstitute(buildProps());

			// When & Then
			expect(() => todo.planItemAddition("가".repeat(201))).toThrow("제목은 1~200자여야 합니다.");
		});
	});

	describe("updateItem", () => {
		it("항목 제목·완료 상태를 전이시키고 변경된 자식 엔티티를 반환한다", () => {
			// Given
			const todo = Todo.reconstitute(buildProps({ items: [buildItem(10, 0)] }));

			// When
			const item = todo.updateItem(10, { title: "수정", completed: true });

			// Then - 엔티티 상태가 단일 소스
			expect(item.toPersistence()).toEqual({ title: "수정", completed: true });
		});

		it("존재하지 않는 항목이면 DomainException(TODO_0822)을 itemId와 함께 던진다", () => {
			// Given
			const todo = Todo.reconstitute(buildProps({ items: [buildItem(10, 0)] }));
			const update = () => todo.updateItem(999, { completed: true });

			// When & Then
			expect(update).toThrow(DomainException);
			try {
				update();
			} catch (error) {
				if (error instanceof DomainException) {
					expect(error.errorCode).toBe(ErrorCode.TODO_0822);
					expect(error.details).toEqual({ itemId: 999 });
				}
			}
		});

		it("항목 제목이 200자를 초과하면 DomainException(SYS_0002)을 던지고 상태를 바꾸지 않는다", () => {
			// Given
			const item = buildItem(10, 0);
			const todo = Todo.reconstitute(buildProps({ items: [item] }));

			// When & Then
			expect(() => todo.updateItem(10, { title: "가".repeat(201) })).toThrow(DomainException);
			expect(item.getTitle()).toBe("항목 10");
		});
	});

	describe("removeItem", () => {
		it("항목을 애그리게잇에서 제거한다", () => {
			// Given
			const todo = Todo.reconstitute(buildProps({ items: [buildItem(10, 0), buildItem(11, 1)] }));

			// When
			todo.removeItem(10);

			// Then
			expect(todo.getItemIds()).toEqual([11]);
			expect(todo.hasItem(10)).toBe(false);
		});

		it("존재하지 않는 항목이면 DomainException(TODO_0822)을 던진다", () => {
			// Given
			const todo = Todo.reconstitute(buildProps({ items: [buildItem(10, 0)] }));

			// When & Then
			expect(() => todo.removeItem(999)).toThrow(DomainException);
			expect(todo.getItemIds()).toEqual([10]);
		});
	});

	describe("validateItemsReorder", () => {
		it("전체 항목 ID 집합이 일치하면 통과한다", () => {
			// Given
			const todo = Todo.reconstitute(
				buildProps({
					items: [buildItem(1, 0), buildItem(2, 1), buildItem(3, 2)],
				}),
			);

			// When & Then
			expect(() => todo.validateItemsReorder([3, 1, 2])).not.toThrow();
		});

		it("중복 ID가 포함되면 길이가 같아도 DomainException(SYS_0002)을 던진다 (정합성 가드)", () => {
			// Given - 항목 [1, 2]인데 [1, 1] 전달 (길이는 일치)
			const todo = Todo.reconstitute(
				buildProps({
					items: [buildItem(1, 0), buildItem(2, 1)],
				}),
			);
			const validate = () => todo.validateItemsReorder([1, 1]);

			// When & Then
			expect(validate).toThrow(DomainException);
			expect(validate).toThrow("중복된 하위 항목 ID가 있습니다");
		});

		it("개수가 다르면 DomainException(SYS_0002)을 기존 메시지·details로 던진다", () => {
			// Given - 항목 3개인데 2개만 전달
			const todo = Todo.reconstitute(
				buildProps({
					items: [buildItem(1, 0), buildItem(2, 1), buildItem(3, 2)],
				}),
			);
			const validate = () => todo.validateItemsReorder([3, 1]);

			// When & Then - 에러 코드·메시지·details 보존 (레거시 계약)
			expect(validate).toThrow(DomainException);
			expect(validate).toThrow("모든 하위 항목 ID를 전달해야 합니다");
			try {
				validate();
			} catch (error) {
				if (error instanceof DomainException) {
					expect(error.errorCode).toBe(ErrorCode.SYS_0002);
					expect(error.details).toEqual({ expected: 3, received: 2 });
				}
			}
		});

		it("모르는 항목 ID가 섞이면 DomainException(TODO_0822)을 itemId와 함께 던진다", () => {
			// Given - 항목 [1,2] 보유인데 999 포함
			const todo = Todo.reconstitute(buildProps({ items: [buildItem(1, 0), buildItem(2, 1)] }));
			const validate = () => todo.validateItemsReorder([999, 1]);

			// When & Then
			expect(validate).toThrow(DomainException);
			try {
				validate();
			} catch (error) {
				if (error instanceof DomainException) {
					expect(error.errorCode).toBe(ErrorCode.TODO_0822);
					expect(error.details).toEqual({ itemId: 999 });
				}
			}
		});
	});

	describe("toPersistence", () => {
		it("가변 필드만 담은 저장용 스냅샷을 반환한다", () => {
			// Given
			const startDate = new Date("2026-02-22");
			const todo = Todo.reconstitute(
				buildProps({ title: "할 일", schedule: buildSchedule({ startDate }) }),
			);

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

		it("반환된 Date를 변조해도 애그리게잇 상태는 영향받지 않는다 (방어 복사)", () => {
			// Given
			const completedAt = new Date("2026-01-01T00:00:00.000Z");
			const todo = Todo.reconstitute(buildProps({ completed: true, completedAt }));

			// When - 스냅샷·getter가 반환한 Date를 임의로 변조
			todo.toPersistence().completedAt?.setFullYear(1999);
			todo.getCompletedAt()?.setFullYear(1999);

			// Then - 내부 값은 불변
			expect(todo.getCompletedAt()).toEqual(completedAt);
			expect(todo.toPersistence().completedAt).toEqual(completedAt);
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
