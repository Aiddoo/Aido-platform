import {
  createTodoImportFixture,
  TODO_IMPORT_FIXTURE_NOW,
} from "#test/fixtures/planning/todo-import.fixture";

import { toTodoImportReadModel } from "./todo-import.read-model.js";

const DEADLINE = Temporal.Instant.from("2026-12-01T03:00:00Z");
const NOW = TODO_IMPORT_FIXTURE_NOW.add({ hours: 1 });

describe("toTodoImportReadModel", () => {
  it.each([
    {
      label: "만든 할 일이 남은 완료",
      fields: { status: "COMPLETED", createdCount: 3, completedAt: TODO_IMPORT_FIXTURE_NOW },
      undoableUntil: DEADLINE,
      failureReason: null,
    },
    {
      label: "만든 할 일이 남은 채 멈춘 실패",
      fields: { status: "FAILED", failureReason: "STALLED", createdCount: 3 },
      undoableUntil: DEADLINE,
      failureReason: "STALLED",
    },
    {
      label: "모두 중복이라 만든 할 일이 없는 완료",
      fields: { status: "COMPLETED", createdCount: 0, completedAt: TODO_IMPORT_FIXTURE_NOW },
      undoableUntil: null,
      failureReason: null,
    },
    {
      label: "아무것도 만들기 전에 실패",
      fields: { status: "FAILED", failureReason: "MATERIALIZATION_FAILED", createdCount: 0 },
      undoableUntil: null,
      failureReason: "MATERIALIZATION_FAILED",
    },
    {
      label: "만드는 중",
      fields: { status: "RUNNING", createdCount: 3 },
      undoableUntil: null,
      failureReason: null,
    },
  ] as const)(
    "$label → 되돌리기 마감 $undoableUntil, 실패 이유 $failureReason",
    ({ fields, undoableUntil, failureReason }) => {
      // Given
      const todoImport = createTodoImportFixture(fields);

      // When
      const readModel = toTodoImportReadModel(todoImport, NOW);

      // Then
      expect(readModel).toMatchObject({ undoableUntil, failureReason });
    },
  );
});
