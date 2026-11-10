import { TestBed } from "@suites/unit";
/**
 * TodoRescheduledHandler 단위 테스트
 *
 * Suites + GWT 패턴 — scheduledTime 유무에 따른 재스케줄/취소 분기 검증
 */
import { vi } from "vitest";

import { TodoRescheduledEvent } from "../../../shared/domain/todo-rescheduled.event.js";
import {
  TODO_REMINDER,
  type TodoReminderPort,
} from "../../application/ports/todo-reminder-scheduler.port.js";
import { TodoRescheduledHandler } from "./todo-rescheduled.event-handler.js";

describe("TodoRescheduledHandler — 일정 변경 이벤트 핸들러", () => {
  let handler: TodoRescheduledHandler;
  let todoReminder: TodoReminderPort;

  beforeEach(async () => {
    todoReminder = {
      scheduleReminder: vi.fn().mockResolvedValue(undefined),
      scheduleReminders: vi.fn(),
      cancelReminders: vi.fn().mockResolvedValue(undefined),
    };

    const { unit } = await TestBed.solitary(TodoRescheduledHandler)
      .mock(TODO_REMINDER)
      .impl(() => todoReminder)
      .compile();

    handler = unit;
  });

  it("scheduledTime이 있으면 리마인더를 재스케줄한다", async () => {
    // Given
    const scheduledTime = new Date("2026-03-01T06:00:00.000Z");

    // When
    await handler.handle(new TodoRescheduledEvent(1, "user-123", scheduledTime));

    // Then
    expect(todoReminder.scheduleReminder).toHaveBeenCalledWith(1, scheduledTime, "user-123");
    expect(todoReminder.cancelReminders).not.toHaveBeenCalled();
  });

  it("scheduledTime이 null이면 리마인더를 취소한다", async () => {
    // Given & When
    await handler.handle(new TodoRescheduledEvent(1, "user-123", null));

    // Then
    expect(todoReminder.cancelReminders).toHaveBeenCalledWith([1]);
    expect(todoReminder.scheduleReminder).not.toHaveBeenCalled();
  });

  it("리마인더 취소 인프라 실패를 전파한다", async () => {
    // Given - 리마인더 취소 실패
    const error = new Error("scheduler down");
    const rejected = Promise.reject(error);
    void rejected.catch(() => undefined);
    vi.mocked(todoReminder.cancelReminders).mockReturnValue(rejected);

    // When & Then - 성공으로 삼키지 않음
    await expect(handler.handle(new TodoRescheduledEvent(1, "user-123", null))).rejects.toBe(error);
  });

  it("non-null 재스케줄 중 기존 리마인더 취소 실패도 전파한다", async () => {
    // Given - schedule 내부의 기존 작업 취소 실패
    const error = new Error(
      "Reminder cancellation failed: todoId=1, stage=60min, runtime=job-runtime",
    );
    const rejected = Promise.reject(error);
    void rejected.catch(() => undefined);
    vi.mocked(todoReminder.scheduleReminder).mockReturnValue(rejected);

    // When & Then - schedule 호출만 시작하고 성공으로 조기 반환하지 않음
    await expect(
      handler.handle(new TodoRescheduledEvent(1, "user-123", new Date("2026-03-01"))),
    ).rejects.toBe(error);
  });
});
