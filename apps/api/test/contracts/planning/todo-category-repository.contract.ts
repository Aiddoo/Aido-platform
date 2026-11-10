import { ErrorCode } from "@aido/api/errors";

import type { TodoCategoryRepositoryPort } from "#api/modules/planning/categories/application/ports/todo-category.repository.port";
import type {
  TodoCategory,
  TodoCategoryPrimitives,
} from "#api/modules/planning/categories/domain/todo-category.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createTodoCategoryFixture } from "#test/fixtures/planning/todo-category.fixture";
import {
  TODO_FIXTURE_NOW,
  TODO_FIXTURE_OTHER_USER_ID,
  TODO_FIXTURE_USER_ID,
} from "#test/fixtures/planning/todo.fixture";

export interface TodoCategoryRepositoryContractContext {
  readonly categoryRepository: TodoCategoryRepositoryPort;
  /** 그 카테고리에 사용자의 할 일 하나를 만든다. 개수·옮기기를 확인할 때만 쓴다. */
  seedTodo(categoryId: number, options?: { readonly completed?: boolean }): Promise<void>;
}

async function insertCategory(
  repository: TodoCategoryRepositoryPort,
  overrides: Partial<TodoCategoryPrimitives> = {},
): Promise<TodoCategory> {
  const category = createTodoCategoryFixture({
    id: (await repository.nextId()).value,
    ...overrides,
  });
  await repository.insert(category);
  return category;
}

export function describeTodoCategoryRepositoryContract(
  createContext: () => Promise<TodoCategoryRepositoryContractContext>,
): void {
  describe("카테고리 저장소 계약", () => {
    it("넣은 카테고리는 주인에게만 보이고 같은 값으로 복원된다", async () => {
      // Given
      const { categoryRepository } = await createContext();
      const category = await insertCategory(categoryRepository, {
        name: "운동",
        color: "#112233",
        sortOrder: 3,
        createdAt: TODO_FIXTURE_NOW,
        updatedAt: TODO_FIXTURE_NOW.add({ seconds: 1 }),
      });

      // When
      const found = await categoryRepository.findByIdAndUserId(
        category.id,
        UserId.reconstitute(TODO_FIXTURE_USER_ID),
      );
      const foreign = await categoryRepository.findByIdAndUserId(
        category.id,
        UserId.reconstitute(TODO_FIXTURE_OTHER_USER_ID),
      );

      // Then
      expect(found?.toPrimitives()).toEqual(category.toPrimitives());
      expect(foreign).toBeNull();
    });

    it("같은 사용자 안 이름이 겹치면 넣기·고치기 모두 TODO_CATEGORY_0853이고 다른 사용자는 괜찮다", async () => {
      // Given
      const { categoryRepository } = await createContext();
      await insertCategory(categoryRepository, { name: "업무" });
      const other = await insertCategory(categoryRepository, { name: "개인", sortOrder: 1 });
      await insertCategory(categoryRepository, {
        userId: TODO_FIXTURE_OTHER_USER_ID,
        name: "업무",
      });

      // When
      const insertDuplicate = insertCategory(categoryRepository, { name: "업무", sortOrder: 2 });
      const renameDuplicate = categoryRepository.update(other.id, { name: "업무" });

      // Then
      await expect(insertDuplicate).rejects.toMatchObject({
        errorCode: ErrorCode.TODO_CATEGORY_0853,
      });
      await expect(renameDuplicate).rejects.toMatchObject({
        errorCode: ErrorCode.TODO_CATEGORY_0853,
      });
      expect(
        await categoryRepository.existsByUserIdAndName(
          UserId.reconstitute(TODO_FIXTURE_USER_ID),
          "업무",
          other.id,
        ),
      ).toBe(true);
    });

    it("고치기는 보낸 칸만 바꾸고 저장된 카테고리를 돌려준다", async () => {
      // Given
      const { categoryRepository } = await createContext();
      const category = await insertCategory(categoryRepository, { name: "업무", color: "#FFB3B3" });

      // When
      const updated = await categoryRepository.update(category.id, { color: "#000000" });

      // Then
      expect(updated.toPrimitives()).toMatchObject({
        name: "업무",
        color: "#000000",
        sortOrder: 0,
      });
    });

    it("목록은 정렬 순서·id 순이고 할 일 개수를 함께 준다", async () => {
      // Given
      const context = await createContext();
      const later = await insertCategory(context.categoryRepository, {
        name: "나중",
        sortOrder: 1,
      });
      const first = await insertCategory(context.categoryRepository, {
        name: "먼저",
        sortOrder: 0,
      });
      await insertCategory(context.categoryRepository, {
        userId: TODO_FIXTURE_OTHER_USER_ID,
        name: "남의 것",
      });
      await context.seedTodo(later.id.value);
      await context.seedTodo(later.id.value);

      // When
      const list = await context.categoryRepository.findManyByUserId(
        UserId.reconstitute(TODO_FIXTURE_USER_ID),
      );
      const single = await context.categoryRepository.findByIdWithCount(later.id);

      // Then
      expect(list.map((category) => [category.id, category.todoCount])).toEqual([
        [first.id.value, 0],
        [later.id.value, 2],
      ]);
      expect(single?.todoCount).toBe(2);
    });

    it("개수·최대 순서는 그 사용자 것만 보고 없으면 최대 순서는 -1이다", async () => {
      // Given
      const { categoryRepository } = await createContext();
      const empty = await categoryRepository.getMaxSortOrder(
        UserId.reconstitute(TODO_FIXTURE_USER_ID),
      );
      await insertCategory(categoryRepository, { name: "가", sortOrder: 4 });
      await insertCategory(categoryRepository, {
        userId: TODO_FIXTURE_OTHER_USER_ID,
        name: "나",
        sortOrder: 9,
      });

      // When
      const count = await categoryRepository.countByUserId(
        UserId.reconstitute(TODO_FIXTURE_USER_ID),
      );
      const max = await categoryRepository.getMaxSortOrder(
        UserId.reconstitute(TODO_FIXTURE_USER_ID),
      );

      // Then
      expect({ empty, count, max }).toEqual({ empty: -1, count: 1, max: 4 });
    });

    it("순서 밀기는 그 사용자 구간 안 카테고리만 옮기고 옮긴 수를 돌려준다", async () => {
      // Given
      const { categoryRepository } = await createContext();
      const categories: TodoCategory[] = [];
      for (const sortOrder of [0, 1, 2]) {
        categories.push(
          await insertCategory(categoryRepository, { name: `카테고리 ${sortOrder}`, sortOrder }),
        );
      }
      await insertCategory(categoryRepository, {
        userId: TODO_FIXTURE_OTHER_USER_ID,
        name: "남의 것",
        sortOrder: 1,
      });

      // When
      const shifted = await categoryRepository.shiftSortOrders(
        UserId.reconstitute(TODO_FIXTURE_USER_ID),
        1,
        null,
        1,
      );

      // Then
      const sortOrders = [];
      for (const category of categories) {
        sortOrders.push(
          (
            await categoryRepository.findByIdAndUserId(
              category.id,
              UserId.reconstitute(TODO_FIXTURE_USER_ID),
            )
          )?.sortOrder,
        );
      }
      expect({ shifted, sortOrders }).toEqual({ shifted: 2, sortOrders: [0, 2, 3] });
    });

    it("할 일을 옮긴 뒤 지우면 옮긴 카테고리에 할 일이 남고 지운 카테고리는 없다", async () => {
      // Given
      const context = await createContext();
      const userId = UserId.reconstitute(TODO_FIXTURE_USER_ID);
      const source = await insertCategory(context.categoryRepository, { name: "옛것" });
      const target = await insertCategory(context.categoryRepository, {
        name: "새것",
        sortOrder: 1,
      });
      await context.seedTodo(source.id.value);
      await context.seedTodo(source.id.value, { completed: true });

      // When
      await context.categoryRepository.moveTodosToCategory(userId, source.id, target.id);
      await context.categoryRepository.delete(source.id);

      // Then
      expect(await context.categoryRepository.countTodos(userId, target.id)).toEqual({
        total: 2,
        completed: 1,
      });
      expect(
        await context.categoryRepository.findByIdAndUserId(
          source.id,
          UserId.reconstitute(TODO_FIXTURE_USER_ID),
        ),
      ).toBeNull();
    });

    it("할 일 수는 그 사용자의 그 카테고리만 센다", async () => {
      // Given
      const context = await createContext();
      const category = await insertCategory(context.categoryRepository);
      await context.seedTodo(category.id.value, { completed: true });

      // When
      const own = await context.categoryRepository.countTodos(
        UserId.reconstitute(TODO_FIXTURE_USER_ID),
        category.id,
      );
      const foreign = await context.categoryRepository.countTodos(
        UserId.reconstitute(TODO_FIXTURE_OTHER_USER_ID),
        category.id,
      );

      // Then
      expect({ own, foreign }).toEqual({
        own: { total: 1, completed: 1 },
        foreign: { total: 0, completed: 0 },
      });
    });
  });
}
