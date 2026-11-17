import { vi } from "vitest";

import { withTodoTargets } from "./notification-todo-target.mapper.js";
import type { NotificationTodoTargetReaderPort } from "./ports/notification-todo-target.reader.port.js";

function createTodoTargetReader(
  targets = new Map([[42, { ownerId: "owner-1", date: "2026-10-27" }]]),
): Pick<NotificationTodoTargetReaderPort, "findTodoTargets"> {
  return { findTodoTargets: vi.fn().mockResolvedValue(targets) };
}

describe("withTodoTargets", () => {
  it("할 일이 없는 알림은 그대로 두고 할 일을 읽지 않는다", async () => {
    // Given
    const todoTargetReader = createTodoTargetReader();
    const input = { userId: "user-1", type: "SYSTEM_NOTICE" as const, title: "제목", body: "본문" };

    // When
    const result = await withTodoTargets([input], todoTargetReader);

    // Then
    expect(result).toEqual([input]);
    expect(todoTargetReader.findTodoTargets).not.toHaveBeenCalled();
  });

  it("할 일 알림은 기존 metadata를 지키며 할 일 주인과 날짜를 더하고 지워진 할 일은 그대로 둔다", async () => {
    // Given
    const todoTargetReader = createTodoTargetReader();
    const comment = {
      userId: "user-1",
      type: "TODO_SHARED" as const,
      title: "제목",
      body: "본문",
      todoId: 42,
      metadata: { commentId: "comment-1" },
    };
    const deleted = { ...comment, todoId: 7, metadata: null };

    // When
    const result = await withTodoTargets([comment, deleted], todoTargetReader);

    // Then
    expect(result).toEqual([
      {
        ...comment,
        metadata: { commentId: "comment-1", todoOwnerId: "owner-1", todoDate: "2026-10-27" },
      },
      deleted,
    ]);
  });
});
