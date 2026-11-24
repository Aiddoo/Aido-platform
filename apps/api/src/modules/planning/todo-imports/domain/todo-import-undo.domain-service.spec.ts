import { judgeUndoWindow } from "./todo-import-undo.domain-service.js";

const COMPLETED_AT = Temporal.Instant.from("2026-11-24T03:00:00Z");
const DEADLINE = Temporal.Instant.from("2026-12-01T03:00:00Z");

describe("judgeUndoWindow", () => {
  it.each([
    { label: "완료 직후", now: COMPLETED_AT, kind: "open" },
    { label: "마감 1밀리초 전", now: DEADLINE.subtract({ milliseconds: 1 }), kind: "open" },
    { label: "마감 순간", now: DEADLINE, kind: "expired" },
  ])("$label → $kind, 마감은 완료 뒤 7일(168시간)이다", ({ now, kind }) => {
    // When
    const window = judgeUndoWindow({ completedAt: COMPLETED_AT, now });

    // Then
    expect(window.kind).toBe(kind);
    expect(window.undoableUntil.equals(DEADLINE)).toBe(true);
  });
});
