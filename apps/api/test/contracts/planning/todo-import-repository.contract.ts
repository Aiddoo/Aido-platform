import type { TodoImportRepositoryPort } from "#api/modules/planning/todo-imports/application/ports/todo-import.repository.port";
import { TodoImportAlreadyActiveError } from "#api/modules/planning/todo-imports/application/todo-imports.errors";
import { TodoImportId } from "#api/modules/planning/todo-imports/domain/todo-import-id.vo";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createTodoImportFixture,
  TODO_IMPORT_FIXTURE_NOW,
  TODO_IMPORT_FIXTURE_OTHER_USER_ID,
  TODO_IMPORT_FIXTURE_USER_ID,
} from "#test/fixtures/planning/todo-import.fixture";

const USER_ID = UserId.reconstitute(TODO_IMPORT_FIXTURE_USER_ID);
const OTHER_USER_ID = UserId.reconstitute(TODO_IMPORT_FIXTURE_OTHER_USER_ID);

function newImportId(): string {
  return TodoImportId.generate().value;
}

export function describeTodoImportRepositoryContract(
  createRepository: () => Promise<TodoImportRepositoryPort>,
): void {
  describe("가져오기 저장소 계약", () => {
    it("저장한 가져오기는 주인과 잡에게 보이고 다른 사용자에게는 없다", async () => {
      // Given
      const repository = await createRepository();
      const todoImport = createTodoImportFixture({ id: newImportId() });
      await repository.save(todoImport);

      // When
      const found = [
        await repository.findByIdAndUserId(todoImport.id, USER_ID),
        await repository.findByIdAndUserId(todoImport.id, OTHER_USER_ID),
        await repository.findById(todoImport.id),
        await repository.findByIdempotencyKey(USER_ID, "start-key-1"),
      ];

      // Then
      expect(found.map((candidate) => candidate?.toPrimitives() ?? null)).toEqual([
        todoImport.toPrimitives(),
        null,
        todoImport.toPrimitives(),
        todoImport.toPrimitives(),
      ]);
    });

    it("진행 중 가져오기만 찾고 사용자마다 둘째 진행 중 가져오기는 저장하지 않는다", async () => {
      // Given
      const repository = await createRepository();
      const ended = createTodoImportFixture({
        id: newImportId(),
        idempotencyKey: "ended",
        status: "COMPLETED",
      });
      const active = createTodoImportFixture({ id: newImportId(), status: "RUNNING" });
      await repository.save(ended);
      await repository.save(active);

      // When
      const found = await repository.findActiveByUserId(USER_ID);
      const second = repository.save(
        createTodoImportFixture({ id: newImportId(), idempotencyKey: "second" }),
      );

      // Then
      expect(found?.id.value).toBe(active.id.value);
      await expect(second).rejects.toBeInstanceOf(TodoImportAlreadyActiveError);
    });

    it("저장한 상태 전이와 카운터를 그대로 다시 읽는다", async () => {
      // Given
      const repository = await createRepository();
      const todoImport = createTodoImportFixture({ id: newImportId() });
      await repository.save(todoImport);
      todoImport.recordReceived(3, TODO_IMPORT_FIXTURE_NOW.add({ seconds: 1 }));
      todoImport.commit({
        createdCategoryIds: new Map(),
        now: TODO_IMPORT_FIXTURE_NOW.add({ seconds: 2 }),
      });

      // When
      await repository.save(todoImport);
      const found = await repository.findById(todoImport.id);

      // Then
      expect(found?.toPrimitives()).toEqual(todoImport.toPrimitives());
    });

    it("멈춘 가져오기를 상태와 마지막 갱신 시각으로 오래된 순서로 고른다", async () => {
      // Given
      const repository = await createRepository();
      const older = createTodoImportFixture({
        id: newImportId(),
        status: "RUNNING",
        updatedAt: TODO_IMPORT_FIXTURE_NOW.subtract({ minutes: 30 }),
      });
      const otherUserOlder = createTodoImportFixture({
        id: newImportId(),
        userId: TODO_IMPORT_FIXTURE_OTHER_USER_ID,
        status: "QUEUED",
        updatedAt: TODO_IMPORT_FIXTURE_NOW.subtract({ minutes: 60 }),
      });
      const fresh = createTodoImportFixture({
        id: newImportId(),
        idempotencyKey: "fresh",
        status: "COMPLETED",
        updatedAt: TODO_IMPORT_FIXTURE_NOW.subtract({ minutes: 60 }),
      });
      for (const todoImport of [older, otherUserOlder, fresh]) {
        await repository.save(todoImport);
      }

      // When
      const stalled = await repository.listStalled({
        statuses: ["QUEUED", "RUNNING"],
        updatedBefore: TODO_IMPORT_FIXTURE_NOW.subtract({ minutes: 10 }),
        limit: 10,
      });

      // Then
      expect(stalled.map((todoImport) => todoImport.id.value)).toEqual([
        otherUserOlder.id.value,
        older.id.value,
      ]);
    });

    it("끝난 지 오래된 가져오기만 limit만큼 지운다", async () => {
      // Given
      const repository = await createRepository();
      const cutoff = TODO_IMPORT_FIXTURE_NOW.subtract({ hours: 24 * 30 });
      const oldEnded = createTodoImportFixture({
        id: newImportId(),
        idempotencyKey: "old",
        status: "UNDONE",
        updatedAt: cutoff.subtract({ hours: 1 }),
      });
      const recentEnded = createTodoImportFixture({
        id: newImportId(),
        idempotencyKey: "recent",
        status: "COMPLETED",
        updatedAt: cutoff.add({ hours: 1 }),
      });
      const oldActive = createTodoImportFixture({
        id: newImportId(),
        idempotencyKey: "active",
        updatedAt: cutoff.subtract({ hours: 1 }),
      });
      for (const todoImport of [oldEnded, recentEnded, oldActive]) {
        await repository.save(todoImport);
      }

      // When
      const deletedCount = await repository.deleteEndedBefore(cutoff, 500);

      // Then
      expect(deletedCount).toBe(1);
      expect(await repository.findById(oldEnded.id)).toBeNull();
      expect(await repository.findById(recentEnded.id)).not.toBeNull();
      expect(await repository.findById(oldActive.id)).not.toBeNull();
    });
  });
}
