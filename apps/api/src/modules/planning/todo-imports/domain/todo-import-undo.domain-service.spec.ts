import { judgeUndoWindow } from "./todo-import-undo.domain-service.js";

const ENDED_AT = Temporal.Instant.from("2026-11-24T03:00:00Z");
const DEADLINE = Temporal.Instant.from("2026-12-01T03:00:00Z");
const COMPLETED = {
  status: "COMPLETED",
  completedAt: ENDED_AT,
  updatedAt: ENDED_AT,
  createdCount: 1,
  undoneCount: 0,
} as const;

describe("judgeUndoWindow", () => {
  it.each([
    { label: "끝난 직후", now: ENDED_AT, kind: "open" },
    { label: "마감 1밀리초 전", now: DEADLINE.subtract({ milliseconds: 1 }), kind: "open" },
    { label: "마감 순간", now: DEADLINE, kind: "expired" },
  ])("$label → $kind, 마감은 끝난 뒤 7일(168시간)이다", ({ now, kind }) => {
    // When
    const window = judgeUndoWindow({ ...COMPLETED, now });

    // Then
    expect(window).toEqual({ kind, undoableUntil: DEADLINE });
  });

  it.each([
    {
      label: "만들다 멈춘 실패는 멈춘 때부터",
      fields: { status: "FAILED", completedAt: null, updatedAt: ENDED_AT },
    },
    {
      label: "되돌리다 멈춘 실패는 처음 완료한 때부터",
      fields: { status: "FAILED", completedAt: ENDED_AT, updatedAt: DEADLINE },
    },
  ] as const)("$label 마감을 센다", ({ fields }) => {
    // When
    const window = judgeUndoWindow({ ...COMPLETED, ...fields, now: ENDED_AT });

    // Then
    expect(window).toEqual({ kind: "open", undoableUntil: DEADLINE });
  });

  it.each([
    { label: "아직 만드는 중", fields: { status: "RUNNING" } },
    { label: "만든 할 일이 없음", fields: { createdCount: 0 } },
    { label: "만든 할 일을 모두 지움", fields: { createdCount: 5, undoneCount: 5 } },
  ] as const)("$label → 되돌릴 것이 없다", ({ fields }) => {
    // When
    const window = judgeUndoWindow({ ...COMPLETED, ...fields, now: ENDED_AT });

    // Then
    expect(window).toEqual({ kind: "unavailable" });
  });
});
