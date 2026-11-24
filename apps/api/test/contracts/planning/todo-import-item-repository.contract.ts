import type { TodoImportItemRepositoryPort } from "#api/modules/planning/todo-imports/application/ports/todo-import-item.repository.port";
import type { TodoImportId } from "#api/modules/planning/todo-imports/domain/todo-import-id.vo";
import {
  createTodoImportItemFixture,
  TODO_IMPORT_FIXTURE_TODAY,
} from "#test/fixtures/planning/todo-import.fixture";

export interface TodoImportItemRepositoryContractSetup {
  readonly items: TodoImportItemRepositoryPort;
  // 저장소가 FK로 요구하는 가져오기를 미리 둔 id
  readonly importId: TodoImportId;
}

export function describeTodoImportItemRepositoryContract(
  setUp: () => Promise<TodoImportItemRepositoryContractSetup>,
): void {
  describe("가져오기 항목 저장소 계약", () => {
    it("이미 받은 일정 키는 건너뛰고 새로 넣은 수만 센다", async () => {
      // Given
      const { items, importId } = await setUp();
      await items.insertMany(importId, [createTodoImportItemFixture("a")]);

      // When
      const accepted = await items.insertMany(importId, [
        createTodoImportItemFixture("a", { title: "다시 보낸 일정" }),
        createTodoImportItemFixture("b"),
      ]);

      // Then
      expect(accepted).toBe(1);
      const titles = (await items.listPending(importId, 10)).map((item) => item.value.title);
      expect(titles.toSorted()).toEqual(["일정 a", "일정 b"]);
    });

    it("대기 항목을 가까운 날짜, 이른 시각(시각 없는 일정은 뒤), 키 순서로 고르고 표시한 항목은 뺀다", async () => {
      // Given
      const { items, importId } = await setUp();
      const tomorrow = TODO_IMPORT_FIXTURE_TODAY.add({ days: 1 });
      await items.insertMany(importId, [
        createTodoImportItemFixture("later-day", { startDate: tomorrow, localTime: "08:00" }),
        createTodoImportItemFixture("all-day", { localTime: null }),
        createTodoImportItemFixture("noon", { localTime: "12:00" }),
        createTodoImportItemFixture("morning", { localTime: "07:30" }),
        createTodoImportItemFixture("done", { localTime: "06:00" }),
      ]);
      await items.markOutcomes(
        importId,
        new Map([[createTodoImportItemFixture("done").sourceKey, "CREATED"]]),
      );

      // When
      const pending = await items.listPending(importId, 3);

      // Then
      expect(pending.map((item) => item.value.title)).toEqual([
        "일정 morning",
        "일정 noon",
        "일정 all-day",
      ]);
    });

    it("가져오기의 항목을 모두 지운다", async () => {
      // Given
      const { items, importId } = await setUp();
      await items.insertMany(importId, [
        createTodoImportItemFixture("a"),
        createTodoImportItemFixture("b"),
      ]);

      // When
      await items.deleteByImportId(importId);

      // Then
      expect(await items.listPending(importId, 10)).toEqual([]);
    });
  });
}
