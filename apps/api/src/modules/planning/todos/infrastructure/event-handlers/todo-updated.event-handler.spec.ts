import { TestBed } from "@suites/unit";
/**
 * TodoUpdatedHandler 단위 테스트
 *
 * Suites + GWT 패턴 — 완료 요청 여부에 따른 리마인더 취소 분기 검증
 */
import { vi } from "vitest";

import { TodoUpdatedEvent } from "../../../shared/domain/todo-updated.event.js";
import {
  TODO_REMINDER,
  type TodoReminderPort,
} from "../../application/ports/todo-reminder-scheduler.port.js";
import { TodoUpdatedHandler } from "./todo-updated.event-handler.js";

describe("TodoUpdatedHandler — 부분 수정 이벤트 핸들러", () => {
  let handler: TodoUpdatedHandler;
  let todoReminder: TodoReminderPort;

  beforeEach(async () => {
    todoReminder = {
      scheduleReminder: vi.fn(),
      scheduleReminders: vi.fn(),
      cancelReminders: vi.fn().mockResolvedValue(undefined),
    };

    const { unit } = await TestBed.solitary(TodoUpdatedHandler)
      .mock(TODO_REMINDER)
      .impl(() => todoReminder)
      .compile();

    handler = unit;
  });

  it("완료 요청(completed=true)이면 리마인더를 취소한다", async () => {
    // Given & When
    await handler.handle(new TodoUpdatedEvent(1, "user-123", true));

    // Then
    expect(todoReminder.cancelReminders).toHaveBeenCalledWith([1]);
  });

  it("미완료 요청(completed=false)이면 리마인더를 취소하지 않는다", async () => {
    // Given & When
    await handler.handle(new TodoUpdatedEvent(1, "user-123", false));

    // Then
    expect(todoReminder.cancelReminders).not.toHaveBeenCalled();
  });

  it("리마인더 인프라 실패를 전파한다", async () => {
    // Given - 리마인더 취소 실패 (기존 sync 핸들러의 유실을 RED로 포착)
    const error = new Error("scheduler down");
    const rejected = Promise.reject(error);
    void rejected.catch(() => undefined);
    vi.mocked(todoReminder.cancelReminders).mockReturnValue(rejected);

    // When & Then - 성공으로 삼키지 않음
    await expect(handler.handle(new TodoUpdatedEvent(1, "user-123", true))).rejects.toBe(error);
  });
});
