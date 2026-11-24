import type { TodoImportLinkRepositoryPort } from "#api/modules/planning/todo-imports/application/ports/todo-import-link.repository.port";
import type { TodoImportId } from "#api/modules/planning/todo-imports/domain/todo-import-id.vo";
import { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  hashedKey,
  TODO_IMPORT_FIXTURE_NOW,
  TODO_IMPORT_FIXTURE_OTHER_USER_ID,
  TODO_IMPORT_FIXTURE_USER_ID,
} from "#test/fixtures/planning/todo-import.fixture";

const USER_ID = UserId.reconstitute(TODO_IMPORT_FIXTURE_USER_ID);
const OTHER_USER_ID = UserId.reconstitute(TODO_IMPORT_FIXTURE_OTHER_USER_ID);

export interface TodoImportLinkRepositoryContractSetup {
  readonly links: TodoImportLinkRepositoryPort;
  readonly importId: TodoImportId;
  // FK로 요구하는 할 일을 미리 둔 id. 앞 셋은 USER, 마지막은 OTHER_USER 할 일이다
  readonly todoIds: readonly [number, number, number, number];
}

function linkOf(params: {
  readonly todoId: number;
  readonly userId: UserId;
  readonly seed: string;
  readonly importId: TodoImportId;
}) {
  return {
    todoId: TodoId.reconstitute(params.todoId),
    userId: params.userId,
    sourceKey: hashedKey(params.seed),
    importId: params.importId,
    createdAt: TODO_IMPORT_FIXTURE_NOW,
  };
}

export function describeTodoImportLinkRepositoryContract(
  setUp: () => Promise<TodoImportLinkRepositoryContractSetup>,
): void {
  describe("가져오기 링크 저장소 계약", () => {
    it("그 사용자가 이미 할 일로 만든 일정 키만 돌려주고 같은 키의 링크는 하나만 남긴다", async () => {
      // Given
      const { links, importId, todoIds } = await setUp();
      const [first, second, , otherUsers] = todoIds;
      await links.insertMany([
        linkOf({ todoId: first, userId: USER_ID, seed: "a", importId }),
        linkOf({ todoId: second, userId: USER_ID, seed: "a", importId }),
        linkOf({ todoId: otherUsers, userId: OTHER_USER_ID, seed: "b", importId }),
      ]);

      // When
      const linked = await links.listLinkedSourceKeys(USER_ID, [hashedKey("a"), hashedKey("b")]);

      // Then
      expect([...linked]).toEqual([hashedKey("a")]);
      expect(await links.countByImportId(importId)).toBe(2);
    });

    it("가져오기의 할 일 id를 오름차순으로 이어서 나눠 준다", async () => {
      // Given
      const { links, importId, todoIds } = await setUp();
      const [first, second, third] = todoIds;
      await links.insertMany(
        [third, first, second].map((todoId, index) =>
          linkOf({ todoId, userId: USER_ID, seed: `seed-${index}`, importId }),
        ),
      );

      // When
      const firstPage = await links.listTodoIds({ importId, afterTodoId: null, limit: 2 });
      const nextPage = await links.listTodoIds({
        importId,
        afterTodoId: firstPage.at(-1) ?? null,
        limit: 2,
      });

      // Then
      expect([...firstPage, ...nextPage].map((todoId) => todoId.value)).toEqual(
        [first, second, third].toSorted((left, right) => left - right),
      );
      expect(nextPage).toHaveLength(1);
    });
  });
}
