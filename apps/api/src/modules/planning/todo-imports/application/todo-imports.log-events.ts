// 일정 제목·키는 남기지 않고 id·수만 남긴다
export const TodoImportLogEvent = {
  STARTED: "planning.todo-import.started",
  COMMITTED: "planning.todo-import.committed",
  CANCELED: "planning.todo-import.canceled",
  COMPLETED: "planning.todo-import.completed",
  FAILED: "planning.todo-import.failed",
  UNDO_REQUESTED: "planning.todo-import.undo.requested",
  UNDONE: "planning.todo-import.undone",
  ATTEMPT_FAILED: "planning.todo-import.attempt.failed",
} as const;
