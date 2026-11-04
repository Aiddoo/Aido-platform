import { TestBed } from "@suites/unit";
/**
 * TodoDeletedHandler 단위 테스트
 *
 * Suites + GWT 패턴
 */
import { vi } from "vitest";

import {
  TODO_REMINDER,
  type TodoReminderPort,
} from "../../../application/ports/todos/todo-reminder.port.js";
import { TodoDeletedEvent } from "../../../domain/events/todos/todo-deleted.event.js";
import { TodoDeletedHandler } from "./todo-deleted.handler.js";

describe("TodoDeletedHandler — 삭제 이벤트 핸들러", () => {
  let handler: TodoDeletedHandler;
  let todoReminder: TodoReminderPort;

  beforeEach(async () => {
    todoReminder = {
      scheduleReminder: vi.fn(),
      scheduleReminders: vi.fn(),
      cancelReminders: vi.fn().mockResolvedValue(undefined),
    };

    const { unit } = await TestBed.solitary(TodoDeletedHandler)
      .mock(TODO_REMINDER)
      .impl(() => todoReminder)
      .compile();

    handler = unit;
  });

  it("삭제된 할 일의 리마인더를 취소한다", async () => {
    // Given & When
    await handler.handle(new TodoDeletedEvent(1, "user-123"));

    // Then
    expect(todoReminder.cancelReminders).toHaveBeenCalledWith([1]);
  });

  it("리마인더 인프라 실패를 전파한다", async () => {
    // Given - 리마인더 취소 실패
    const error = new Error("scheduler down");
    const rejected = Promise.reject(error);
    void rejected.catch(() => undefined);
    vi.mocked(todoReminder.cancelReminders).mockReturnValue(rejected);

    // When & Then - 성공으로 삼키지 않음
    await expect(handler.handle(new TodoDeletedEvent(1, "user-123"))).rejects.toBe(error);
  });
});
