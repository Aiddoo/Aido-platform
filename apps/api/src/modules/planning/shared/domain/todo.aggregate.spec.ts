import { ErrorCode } from "@aido/api/errors";
import { TODO_ITEM_LIMITS } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createTodoFixture,
  createTodoItemFixture,
  createTodoPrimitivesFixture,
  TODO_FIXTURE_NOW,
  TODO_FIXTURE_USER_ID,
} from "#test/fixtures/planning/todo.fixture";

import { TodoCategoryChangedEvent } from "./todo-category-changed.event.js";
import { TodoCreatedEvent } from "./todo-created.event.js";
import { TodoId } from "./todo-id.vo.js";
import { TodoItemId } from "./todo-item-id.vo.js";
import { TodoRescheduledEvent } from "./todo-rescheduled.event.js";
import { TodoSchedule } from "./todo-schedule.vo.js";
import { TodoTitle } from "./todo-title.vo.js";
import { TodoToggledEvent } from "./todo-toggled.event.js";
import { TodoUpdatedEvent } from "./todo-updated.event.js";
import { TodoVisibilityChangedEvent } from "./todo-visibility-changed.event.js";
import { Todo } from "./todo.aggregate.js";

const NOW = TODO_FIXTURE_NOW;
const LATER = NOW.add({ minutes: 5 });

function itemsWithSortOrders(...sortOrders: number[]) {
  return sortOrders.map((sortOrder, index) =>
    createTodoItemFixture({ id: index + 1, title: `항목 ${index + 1}`, sortOrder }),
  );
}

function createTodo(overrides: { scheduledLocalTime?: string | null } = {}): Todo {
  return Todo.create({
    id: TodoId.reconstitute(1),
    userId: UserId.reconstitute(TODO_FIXTURE_USER_ID),
    categoryId: 1,
    title: TodoTitle.create("새 할 일"),
    schedule: TodoSchedule.create({
      startDate: Temporal.PlainDate.from("2026-11-10"),
      endDate: null,
      scheduledLocalTime: overrides.scheduledLocalTime ?? null,
      isAllDay: true,
      timezone: "UTC",
    }),
    visibility: "PUBLIC",
    sortOrder: 4,
    now: NOW,
  });
}

describe("Todo — 할 일 애그리게잇", () => {
  describe("create", () => {
    it("미완료·항목 없음으로 만들고 생성 시각을 수정 시각으로도 쓴다", () => {
      // When
      const todo = createTodo();

      // Then
      expect(todo.toPrimitives()).toEqual(
        createTodoPrimitivesFixture({ id: 1, title: "새 할 일", sortOrder: 4 }),
      );
    });

    it("시간이 있으면 시간 일정으로 맞추고 그 순간을 담은 TodoCreatedEvent를 적립한다", () => {
      // When
      const todo = createTodo({ scheduledLocalTime: "09:00" });

      // Then
      const scheduledTime = Temporal.Instant.from("2026-11-10T09:00:00.000Z");
      expect(todo.schedule.isAllDay).toBe(false);
      expect(todo.schedule.scheduledTime).toEqual(scheduledTime);
      const events = todo.pullDomainEvents();
      expect(events).toHaveLength(1);
      const event = events[0];
      expect(event).toBeInstanceOf(TodoCreatedEvent);
      if (event instanceof TodoCreatedEvent) {
        expect(event.todoId).toBe(1);
        expect(event.userId).toBe(TODO_FIXTURE_USER_ID);
        expect(event.scheduledTime).toEqual(scheduledTime);
      }
    });
  });

  describe("toggleComplete", () => {
    it("완료로 전환하면 true를 반환하고 completedAt이 설정되며 TodoToggledEvent를 적립한다", () => {
      // Given
      const todo = createTodoFixture({ completed: false });

      // When
      const changed = todo.toggleComplete(true, "Asia/Seoul", LATER);

      // Then
      expect(changed).toBe(true);
      expect(todo.completed).toBe(true);
      expect(todo.completedAt).toEqual(LATER);
      const events = todo.pullDomainEvents();
      expect(events).toHaveLength(1);
      const event = events[0];
      expect(event).toBeInstanceOf(TodoToggledEvent);
      if (event instanceof TodoToggledEvent) {
        expect(event.completed).toBe(true);
        expect(event.timezone).toBe("Asia/Seoul");
        expect(event.userId).toBe(TODO_FIXTURE_USER_ID);
      }
    });

    it("미완료로 전환하면 completedAt이 null로 초기화된다", () => {
      // Given
      const todo = createTodoFixture({ completed: true, completedAt: NOW });

      // When
      const changed = todo.toggleComplete(false, "UTC", LATER);

      // Then
      expect(changed).toBe(true);
      expect(todo.completed).toBe(false);
      expect(todo.completedAt).toBeNull();
      const event = todo.pullDomainEvents()[0];
      expect(event).toBeInstanceOf(TodoToggledEvent);
      if (event instanceof TodoToggledEvent) {
        expect(event.completed).toBe(false);
      }
    });

    it("같은 값으로 재토글하면 false를 반환하고 상태·이벤트 모두 변화가 없다 (스트릭/알림 재발화 억제)", () => {
      // Given
      const todo = createTodoFixture({ completed: true, completedAt: NOW });

      // When
      const changed = todo.toggleComplete(true, "UTC", LATER);

      // Then
      expect(changed).toBe(false);
      expect(todo.completed).toBe(true);
      expect(todo.completedAt).toEqual(NOW);
      expect(todo.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe("rename", () => {
    it("제목을 바꾸면 true이고 전이 후 완료 상태를 담은 TodoUpdatedEvent를 적립한다", () => {
      // Given
      const todo = createTodoFixture({ title: "이전 제목", completed: true, completedAt: NOW });

      // When
      const changed = todo.rename(TodoTitle.create("새 제목"), LATER);

      // Then
      expect(changed).toBe(true);
      expect(todo.title.value).toBe("새 제목");
      const event = todo.pullDomainEvents()[0];
      expect(event).toBeInstanceOf(TodoUpdatedEvent);
      if (event instanceof TodoUpdatedEvent) {
        expect(event.completed).toBe(true);
      }
    });

    it("같은 제목이면 false이고 이벤트가 없다", () => {
      // Given
      const todo = createTodoFixture({ title: "장보기" });

      // When
      const changed = todo.rename(TodoTitle.create("장보기"), LATER);

      // Then
      expect(changed).toBe(false);
      expect(todo.pullDomainEvents()).toHaveLength(0);
      expect(todo.toPrimitives().updatedAt).toEqual(NOW);
    });
  });

  describe("updateDetails", () => {
    it("정의된 필드만 변경하고 전이 후 완료 상태를 담은 TodoUpdatedEvent를 적립한다", () => {
      // Given
      const todo = createTodoFixture({ title: "이전 제목" });

      // When
      const changed = todo.updateDetails({ title: "새 제목" }, "UTC", LATER);

      // Then
      expect(changed).toBe(true);
      expect(todo.title.value).toBe("새 제목");
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
      // Given
      const todo = createTodoFixture({ completed: true, completedAt: NOW });

      // When
      todo.updateDetails({ title: "새 제목" }, "UTC", LATER);

      // Then
      const event = todo.pullDomainEvents()[0];
      expect(event).toBeInstanceOf(TodoUpdatedEvent);
      if (event instanceof TodoUpdatedEvent) {
        expect(event.completed).toBe(true);
      }
    });

    it("빈 패치(모든 필드 undefined)면 상태 변화 없이 이벤트도 적립하지 않는다", () => {
      // Given
      const todo = createTodoFixture({ title: "이전 제목" });

      // When
      const changed = todo.updateDetails({}, "UTC", LATER);

      // Then
      expect(changed).toBe(false);
      expect(todo.title.value).toBe("이전 제목");
      expect(todo.pullDomainEvents()).toHaveLength(0);
    });

    it("보낸 값이 모두 지금과 같으면 false이고 이벤트가 없다", () => {
      // Given
      const todo = createTodoFixture({ title: "장보기", categoryId: 3, visibility: "PRIVATE" });

      // When
      const changed = todo.updateDetails(
        {
          title: "장보기",
          categoryId: 3,
          visibility: "PRIVATE",
          startDate: Temporal.PlainDate.from("2026-11-10"),
          completed: false,
        },
        "UTC",
        LATER,
      );

      // Then
      expect(changed).toBe(false);
      expect(todo.pullDomainEvents()).toHaveLength(0);
      expect(todo.toPrimitives().updatedAt).toEqual(NOW);
    });

    it("미완료→완료 전이 시 completedAt을 설정한다", () => {
      // Given
      const todo = createTodoFixture({ completed: false });

      // When
      todo.updateDetails({ completed: true }, "UTC", LATER);

      // Then
      expect(todo.completed).toBe(true);
      expect(todo.completedAt).toEqual(LATER);
    });

    it("완료→미완료 전이 시 completedAt을 null로 초기화하고 시각이 있으면 리마인더를 다시 잡는다", () => {
      // Given
      const scheduledTime = Temporal.Instant.from("2026-11-10T09:00:00.000Z");
      const todo = createTodoFixture({
        completed: true,
        completedAt: NOW,
        scheduledLocalTime: "09:00",
        scheduledTime,
        isAllDay: false,
      });

      // When
      todo.updateDetails({ completed: false }, "UTC", LATER);

      // Then
      expect(todo.completed).toBe(false);
      expect(todo.completedAt).toBeNull();
      const events = todo.pullDomainEvents();
      expect(events.map((event) => event.constructor)).toEqual([
        TodoUpdatedEvent,
        TodoRescheduledEvent,
      ]);
      const rescheduled = events[1];
      if (rescheduled instanceof TodoRescheduledEvent) {
        expect(rescheduled.scheduledTime).toEqual(scheduledTime);
      }
    });

    it("같은 완료 상태로 재요청하면 completedAt을 변경하지 않는다 (레거시 동작 보존)", () => {
      // Given
      const todo = createTodoFixture({ completed: true, completedAt: NOW });

      // When
      todo.updateDetails({ completed: true }, "UTC", LATER);

      // Then
      expect(todo.completedAt).toEqual(NOW);
    });

    it("시각을 바꾸면 새 순간을 담은 TodoRescheduledEvent도 적립한다", () => {
      // Given
      const todo = createTodoFixture();

      // When
      todo.updateDetails({ scheduledLocalTime: "18:30" }, "UTC", LATER);

      // Then
      const events = todo.pullDomainEvents();
      expect(events.map((event) => event.constructor)).toEqual([
        TodoUpdatedEvent,
        TodoRescheduledEvent,
      ]);
      const rescheduled = events[1];
      if (rescheduled instanceof TodoRescheduledEvent) {
        expect(rescheduled.scheduledTime).toEqual(
          Temporal.Instant.from("2026-11-10T18:30:00.000Z"),
        );
      }
    });

    it("제목이 200자를 초과하면 DomainException을 던진다", () => {
      // Given
      const todo = createTodoFixture();

      // When
      const update = () => todo.updateDetails({ title: "가".repeat(201) }, "UTC", LATER);

      // Then
      expect(update).toThrow("제목은 1~200자여야 합니다.");
    });

    it("endDate만 패치해도 저장된 startDate와 교차 검증해 역전이면 DomainException(SYS_0002)을 던진다", () => {
      // Given
      const todo = createTodoFixture({ startDate: Temporal.PlainDate.from("2026-11-10") });

      // When
      const update = () =>
        todo.updateDetails({ endDate: Temporal.PlainDate.from("2026-11-08") }, "UTC", LATER);

      // Then
      expect(update).toThrow(expect.objectContaining({ errorCode: ErrorCode.SYS_0002 }));
      expect(update).toThrow(DomainException);
      expect(todo.schedule.endDate).toBeNull();
      expect(todo.pullDomainEvents()).toHaveLength(0);
    });

    it("startDate만 패치해도 저장된 endDate와 교차 검증해 역전이면 어떤 필드도 변경하지 않는다 (부분 변경 방지)", () => {
      // Given
      const todo = createTodoFixture({
        title: "이전 제목",
        startDate: Temporal.PlainDate.from("2026-11-10"),
        endDate: Temporal.PlainDate.from("2026-11-13"),
      });

      // When
      const update = () =>
        todo.updateDetails(
          { title: "새 제목", startDate: Temporal.PlainDate.from("2026-11-20") },
          "UTC",
          LATER,
        );

      // Then
      expect(update).toThrow(DomainException);
      expect(todo.title.value).toBe("이전 제목");
      expect(todo.schedule.startDate).toEqual(Temporal.PlainDate.from("2026-11-10"));
    });
  });

  describe("reschedule", () => {
    it("일정을 변경하고 scheduledTime을 담은 TodoRescheduledEvent를 적립한다", () => {
      // Given
      const todo = createTodoFixture();

      // When
      const changed = todo.reschedule(
        TodoSchedule.create({
          startDate: Temporal.PlainDate.from("2026-11-12"),
          endDate: null,
          scheduledLocalTime: "06:00",
          isAllDay: false,
          timezone: "UTC",
        }),
        LATER,
      );

      // Then
      expect(changed).toBe(true);
      const event = todo.pullDomainEvents()[0];
      expect(event).toBeInstanceOf(TodoRescheduledEvent);
      if (event instanceof TodoRescheduledEvent) {
        expect(event.scheduledTime).toEqual(Temporal.Instant.from("2026-11-12T06:00:00.000Z"));
      }
    });

    it("scheduledTime 없이 변경하면 이벤트의 scheduledTime이 null이다 (리마인더 취소 트리거)", () => {
      // Given
      const todo = createTodoFixture({
        scheduledLocalTime: "09:00",
        scheduledTime: Temporal.Instant.from("2026-11-10T09:00:00.000Z"),
        isAllDay: false,
      });

      // When
      todo.reschedule(
        TodoSchedule.create({
          startDate: Temporal.PlainDate.from("2026-11-11"),
          endDate: null,
          scheduledLocalTime: null,
          isAllDay: true,
          timezone: "UTC",
        }),
        LATER,
      );

      // Then
      const event = todo.pullDomainEvents()[0];
      expect(event).toBeInstanceOf(TodoRescheduledEvent);
      if (event instanceof TodoRescheduledEvent) {
        expect(event.scheduledTime).toBeNull();
      }
    });

    it("같은 일정이면 false이고 이벤트가 없다", () => {
      // Given
      const todo = createTodoFixture({ startDate: Temporal.PlainDate.from("2026-11-10") });

      // When
      const changed = todo.reschedule(
        TodoSchedule.create({
          startDate: Temporal.PlainDate.from("2026-11-10"),
          endDate: null,
          scheduledLocalTime: null,
          isAllDay: true,
          timezone: "UTC",
        }),
        LATER,
      );

      // Then
      expect(changed).toBe(false);
      expect(todo.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe("changeVisibility / changeCategory", () => {
    it("공개 범위를 변경하고 TodoVisibilityChangedEvent를 적립한다", () => {
      // Given
      const todo = createTodoFixture({ id: 3, visibility: "PUBLIC" });

      // When
      const changed = todo.changeVisibility("PRIVATE", LATER);

      // Then
      expect(changed).toBe(true);
      expect(todo.visibility).toBe("PRIVATE");
      const event = todo.pullDomainEvents()[0];
      expect(event).toBeInstanceOf(TodoVisibilityChangedEvent);
      if (event instanceof TodoVisibilityChangedEvent) {
        expect(event.todoId).toBe(3);
        expect(event.userId).toBe(TODO_FIXTURE_USER_ID);
      }
    });

    it("카테고리를 변경하고 TodoCategoryChangedEvent를 적립한다 (일별 완료 색상 집계 캐시 무효화)", () => {
      // Given
      const todo = createTodoFixture({ id: 3, categoryId: 1 });

      // When
      const changed = todo.changeCategory(7, LATER);

      // Then
      expect(changed).toBe(true);
      expect(todo.categoryId).toBe(7);
      const event = todo.pullDomainEvents()[0];
      expect(event).toBeInstanceOf(TodoCategoryChangedEvent);
      if (event instanceof TodoCategoryChangedEvent) {
        expect(event.todoId).toBe(3);
        expect(event.userId).toBe(TODO_FIXTURE_USER_ID);
        expect(event.categoryId).toBe(7);
      }
    });

    it("같은 공개 범위·카테고리면 false이고 이벤트가 없다", () => {
      // Given
      const todo = createTodoFixture({ categoryId: 1, visibility: "PUBLIC" });

      // When
      const changes = [todo.changeVisibility("PUBLIC", LATER), todo.changeCategory(1, LATER)];

      // Then
      expect(changes).toEqual([false, false]);
      expect(todo.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe("addItem", () => {
    it("보유 항목의 최대 sortOrder + 1로 끝에 붙인다", () => {
      // Given
      const todo = createTodoFixture({ items: itemsWithSortOrders(0, 3) });

      // When
      const item = todo.addItem({
        id: TodoItemId.reconstitute(12),
        title: TodoTitle.create("새 항목"),
        now: LATER,
      });

      // Then
      expect(item.toPrimitives()).toEqual(
        createTodoItemFixture({
          id: 12,
          title: "새 항목",
          sortOrder: 4,
          createdAt: LATER,
          updatedAt: LATER,
        }),
      );
      expect(todo.items.map((entry) => entry.id.value)).toEqual([1, 2, 12]);
    });

    it("항목이 없으면 sortOrder 0으로 붙인다", () => {
      // Given
      const todo = createTodoFixture({ items: [] });

      // When
      const item = todo.addItem({
        id: TodoItemId.reconstitute(1),
        title: TodoTitle.create("첫 항목"),
        now: LATER,
      });

      // Then
      expect(item.sortOrder).toBe(0);
    });

    it("항목 수가 MAX_PER_TODO에 도달하면 DomainException(TODO_0821)을 상세 정보와 함께 던진다", () => {
      // Given
      const todo = createTodoFixture({
        items: itemsWithSortOrders(
          ...Array.from({ length: TODO_ITEM_LIMITS.MAX_PER_TODO }, (_, index) => index),
        ),
      });

      // When
      const add = () =>
        todo.addItem({
          id: TodoItemId.reconstitute(999),
          title: TodoTitle.create("초과 항목"),
          now: LATER,
        });

      // Then
      expect(add).toThrow(DomainException);
      expect(add).toThrow(
        expect.objectContaining({
          errorCode: ErrorCode.TODO_0821,
          details: {
            currentCount: TODO_ITEM_LIMITS.MAX_PER_TODO,
            maxPerTodo: TODO_ITEM_LIMITS.MAX_PER_TODO,
          },
        }),
      );
    });
  });

  describe("updateItem", () => {
    it("항목 제목·완료 상태를 전이시키고 true를 반환한다", () => {
      // Given
      const todo = createTodoFixture({ items: itemsWithSortOrders(0) });

      // When
      const changed = todo.updateItem(1, { title: "수정", completed: true }, LATER);

      // Then
      expect(changed).toBe(true);
      expect(todo.items[0]?.toPrimitives()).toMatchObject({ title: "수정", completed: true });
    });

    it("같은 제목·완료 상태면 false다", () => {
      // Given
      const todo = createTodoFixture({ items: itemsWithSortOrders(0) });

      // When
      const changed = todo.updateItem(1, { title: "항목 1", completed: false }, LATER);

      // Then
      expect(changed).toBe(false);
    });

    it("존재하지 않는 항목이면 DomainException(TODO_0822)을 itemId와 함께 던진다", () => {
      // Given
      const todo = createTodoFixture({ items: itemsWithSortOrders(0) });

      // When
      const update = () => todo.updateItem(999, { completed: true }, LATER);

      // Then
      expect(update).toThrow(DomainException);
      expect(update).toThrow(
        expect.objectContaining({
          errorCode: ErrorCode.TODO_0822,
          details: { itemId: 999 },
        }),
      );
    });

    it("항목 제목이 200자를 초과하면 DomainException(SYS_0002)을 던지고 상태를 바꾸지 않는다", () => {
      // Given
      const todo = createTodoFixture({ items: itemsWithSortOrders(0) });

      // When
      const update = () => todo.updateItem(1, { title: "가".repeat(201), completed: true }, LATER);

      // Then
      expect(update).toThrow(DomainException);
      expect(todo.items[0]?.toPrimitives()).toMatchObject({ title: "항목 1", completed: false });
    });
  });

  describe("removeItem", () => {
    it("항목을 애그리게잇에서 제거한다", () => {
      // Given
      const todo = createTodoFixture({ items: itemsWithSortOrders(0, 1) });

      // When
      todo.removeItem(1);

      // Then
      expect(todo.items.map((item) => item.id.value)).toEqual([2]);
    });

    it("존재하지 않는 항목이면 DomainException(TODO_0822)을 던진다", () => {
      // Given
      const todo = createTodoFixture({ items: itemsWithSortOrders(0) });

      // When
      const remove = () => todo.removeItem(999);

      // Then
      expect(remove).toThrow(DomainException);
      expect(todo.items.map((item) => item.id.value)).toEqual([1]);
    });
  });

  describe("validateItemsReorder", () => {
    it("전체 항목 ID 집합이 일치하면 통과한다", () => {
      // Given
      const todo = createTodoFixture({ items: itemsWithSortOrders(0, 1, 2) });

      // When
      const validate = () => todo.validateItemsReorder([3, 1, 2]);

      // Then
      expect(validate).not.toThrow();
    });

    it("중복 ID가 포함되면 길이가 같아도 DomainException(SYS_0002)을 던진다 (정합성 가드)", () => {
      // Given
      const todo = createTodoFixture({ items: itemsWithSortOrders(0, 1) });

      // When
      const validate = () => todo.validateItemsReorder([1, 1]);

      // Then
      expect(validate).toThrow(DomainException);
      expect(validate).toThrow("중복된 하위 항목 ID가 있습니다");
    });

    it("개수가 다르면 DomainException(SYS_0002)을 기존 메시지·details로 던진다", () => {
      // Given
      const todo = createTodoFixture({ items: itemsWithSortOrders(0, 1, 2) });

      // When
      const validate = () => todo.validateItemsReorder([3, 1]);

      // Then
      expect(validate).toThrow("모든 하위 항목 ID를 전달해야 합니다");
      expect(validate).toThrow(
        expect.objectContaining({
          errorCode: ErrorCode.SYS_0002,
          details: { expected: 3, received: 2 },
        }),
      );
    });

    it("모르는 항목 ID가 섞이면 DomainException(TODO_0822)을 itemId와 함께 던진다", () => {
      // Given
      const todo = createTodoFixture({ items: itemsWithSortOrders(0, 1) });

      // When
      const validate = () => todo.validateItemsReorder([999, 1]);

      // Then
      expect(validate).toThrow(
        expect.objectContaining({
          errorCode: ErrorCode.TODO_0822,
          details: { itemId: 999 },
        }),
      );
    });
  });

  describe("toPrimitives", () => {
    it("복원한 값을 그대로 꺼낸다", () => {
      // Given
      const primitives = createTodoPrimitivesFixture({
        id: 42,
        completed: true,
        completedAt: NOW,
        scheduledLocalTime: "09:00",
        scheduledTime: Temporal.Instant.from("2026-11-10T00:00:00.000Z"),
        isAllDay: false,
        seriesId: "series-1",
        occurrenceDate: Temporal.PlainDate.from("2026-11-10"),
        items: itemsWithSortOrders(0, 1),
      });

      // When
      const todo = Todo.reconstitute(primitives);

      // Then
      expect(todo.toPrimitives()).toEqual(primitives);
      expect(todo.id.value).toBe(42);
      expect(todo.userId.value).toBe(TODO_FIXTURE_USER_ID);
    });

    it("순간이 없는 옛 행은 남은 벽시계를 지우고 읽는다", () => {
      // When
      const todo = createTodoFixture({ scheduledLocalTime: "09:00", scheduledTime: null });

      // Then
      expect(todo.toPrimitives().scheduledLocalTime).toBeNull();
    });
  });
});
