import { ErrorCode } from "@aido/api/errors";

import {
  createTodoImportFixture,
  TODO_IMPORT_FIXTURE_COLLECTION_KEY,
  TODO_IMPORT_FIXTURE_NOW,
} from "#test/fixtures/planning/todo-import.fixture";

const LATER = TODO_IMPORT_FIXTURE_NOW.add({ minutes: 5 });
const NO_BATCH_SKIPS = {
  skippedDuplicateCount: 0,
  skippedCapacityCount: 0,
  skippedCategoryMissingCount: 0,
  skippedInvalidCount: 0,
};

describe("TodoImport", () => {
  it("확정하면 새 카테고리 id를 대상에 채우고 대기열에 오르며, 다시 확정하면 false다", () => {
    // Given
    const todoImport = createTodoImportFixture({
      targets: [
        {
          kind: "NEW_CATEGORY",
          targetKey: "new",
          name: "학교",
          color: "#FF0000",
          categoryId: null,
        },
      ],
      collections: [
        {
          collectionKey: TODO_IMPORT_FIXTURE_COLLECTION_KEY,
          targetKey: "new",
          expectedItemCount: 3,
        },
      ],
    });

    // When
    const first = todoImport.commit({ createdCategoryIds: new Map([["new", 77]]), now: LATER });
    const second = todoImport.commit({ createdCategoryIds: new Map(), now: LATER });

    // Then
    expect([first, second]).toEqual([true, false]);
    expect(todoImport.status).toBe("QUEUED");
    expect(todoImport.findCategoryIdOf(TODO_IMPORT_FIXTURE_COLLECTION_KEY)).toBe(77);
  });

  it.each(["CANCELED", "ABANDONED"] as const)("%s 가져오기는 확정할 수 없다", (status) => {
    // Given
    const todoImport = createTodoImportFixture({ status });

    // When
    const commit = () => todoImport.commit({ createdCategoryIds: new Map(), now: LATER });

    // Then
    expect(commit).toThrow(expect.objectContaining({ errorCode: ErrorCode.TODO_IMPORT_2305 }));
  });

  it("묶음 결과를 더하고 가장 이른 날짜를 남기며, 완료하면 완료 시각을 둔다", () => {
    // Given
    const todoImport = createTodoImportFixture({
      status: "RUNNING",
      committedAt: TODO_IMPORT_FIXTURE_NOW,
    });
    const later = Temporal.PlainDate.from("2026-12-01");
    const earlier = Temporal.PlainDate.from("2026-11-25");

    // When
    todoImport.recordBatch({
      counts: { ...NO_BATCH_SKIPS, createdCount: 2, skippedCapacityCount: 1 },
      firstDate: later,
      now: LATER,
    });
    todoImport.recordBatch({
      counts: { ...NO_BATCH_SKIPS, createdCount: 1, skippedDuplicateCount: 4 },
      firstDate: earlier,
      now: LATER,
    });
    const completed = todoImport.complete(LATER);

    // Then
    expect(completed).toBe(true);
    expect(todoImport.toPrimitives()).toMatchObject({
      status: "COMPLETED",
      createdCount: 3,
      skippedCapacityCount: 1,
      skippedDuplicateCount: 4,
      processedItemCount: 8,
      firstDate: earlier,
      completedAt: LATER,
    });
  });

  it("되돌리기는 완료 뒤 7일 안에만 되고, 지나면 마감 시각과 함께 2308이다", () => {
    // Given
    const completedAt = TODO_IMPORT_FIXTURE_NOW;
    const open = createTodoImportFixture({ status: "COMPLETED", completedAt });
    const expired = createTodoImportFixture({ status: "COMPLETED", completedAt });

    // When
    const requested = open.requestUndo(completedAt.add({ hours: 167 }));
    const late = () => expired.requestUndo(completedAt.add({ hours: 168 }));

    // Then
    expect(requested).toBe(true);
    expect(open.status).toBe("UNDOING");
    expect(late).toThrow(
      expect.objectContaining({
        errorCode: ErrorCode.TODO_IMPORT_2308,
        details: { undoableUntil: "2026-12-01T03:00:00.000Z" },
      }),
    );
  });

  it("되돌리기를 마치면 지운 수는 이어서 더하고 남긴 완료 수는 마지막 값으로 둔다", () => {
    // Given
    const todoImport = createTodoImportFixture({ status: "UNDOING" });

    // When
    todoImport.recordUndone(200, LATER);
    todoImport.recordUndone(50, LATER);
    const finished = todoImport.finishUndo(12, LATER);
    const again = todoImport.finishUndo(12, LATER);

    // Then
    expect([finished, again]).toEqual([true, false]);
    expect(todoImport.toPrimitives()).toMatchObject({
      status: "UNDONE",
      undoneCount: 250,
      keptCompletedCount: 12,
    });
  });

  it("멈춘 작업을 다시 넣을 때마다 round와 다시 넣은 수가 하나씩 오른다", () => {
    // Given
    const todoImport = createTodoImportFixture({ status: "RUNNING", round: 4 });

    // When
    todoImport.recordRecovery(LATER);
    todoImport.recordRecovery(LATER);

    // Then
    expect([todoImport.round, todoImport.recoveryCount]).toEqual([6, 2]);
  });

  it("실패는 실행 중 상태에서만 되고 센 수는 그대로 남긴다", () => {
    // Given
    const running = createTodoImportFixture({ status: "RUNNING", createdCount: 40 });
    const uploading = createTodoImportFixture();

    // When
    const failed = running.fail("MATERIALIZATION_FAILED", LATER);
    const notWorking = () => uploading.fail("STALLED", LATER);

    // Then
    expect(failed).toBe(true);
    expect(running.toPrimitives()).toMatchObject({
      status: "FAILED",
      failureReason: "MATERIALIZATION_FAILED",
      createdCount: 40,
    });
    expect(notWorking).toThrow(expect.objectContaining({ errorCode: ErrorCode.TODO_IMPORT_2305 }));
  });
});
