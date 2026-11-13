import type { TodoPrimitives } from "#api/modules/planning/shared/domain/todo.aggregate";
import type { TodoReadRepositoryPort } from "#api/modules/planning/todos/application/ports/todo-read.repository.port";
import type { TodoRepositoryPort } from "#api/modules/planning/todos/application/ports/todo.repository.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createTodoFixture,
  TODO_FIXTURE_NOW,
  TODO_FIXTURE_OTHER_USER_ID,
  TODO_FIXTURE_USER_ID,
} from "#test/fixtures/planning/todo.fixture";

export interface TodoReadRepositoryContractContext {
  /** 할 일을 넣는 쪽. 읽기 저장소와 같은 저장소를 본다 */
  readonly todoRepository: TodoRepositoryPort;
  readonly todoReadRepository: TodoReadRepositoryPort;
  /** 두 사용자가 모두 쓸 수 있는 카테고리 */
  readonly categoryId: number;
}

async function insertTodo(
  context: TodoReadRepositoryContractContext,
  overrides: Partial<TodoPrimitives> = {},
): Promise<void> {
  await context.todoRepository.insert(
    createTodoFixture({
      id: (await context.todoRepository.nextId()).value,
      categoryId: context.categoryId,
      ...overrides,
    }),
  );
}

export function describeTodoReadRepositoryContract(
  createContext: () => Promise<TodoReadRepositoryContractContext>,
): void {
  describe("할 일 읽기 저장소 계약", () => {
    it("할 일·완료한 할 일이 있는지는 날짜와 상관없이 자기 할 일만 본다", async () => {
      // Given
      const context = await createContext();
      const owner = UserId.reconstitute(TODO_FIXTURE_USER_ID);
      await insertTodo(context, {
        userId: TODO_FIXTURE_OTHER_USER_ID,
        completed: true,
        completedAt: TODO_FIXTURE_NOW,
      });
      const empty = {
        hasTodo: await context.todoReadRepository.existsByUserId(owner),
        hasCompletedTodo: await context.todoReadRepository.existsCompletedByUserId(owner),
      };
      await insertTodo(context, { startDate: Temporal.PlainDate.from("2020-01-01") });
      const created = {
        hasTodo: await context.todoReadRepository.existsByUserId(owner),
        hasCompletedTodo: await context.todoReadRepository.existsCompletedByUserId(owner),
      };

      // When
      await insertTodo(context, {
        startDate: Temporal.PlainDate.from("2030-12-31"),
        completed: true,
        completedAt: TODO_FIXTURE_NOW,
      });
      const completed = {
        hasTodo: await context.todoReadRepository.existsByUserId(owner),
        hasCompletedTodo: await context.todoReadRepository.existsCompletedByUserId(owner),
      };

      // Then
      expect(empty).toEqual({ hasTodo: false, hasCompletedTodo: false });
      expect(created).toEqual({ hasTodo: true, hasCompletedTodo: false });
      expect(completed).toEqual({ hasTodo: true, hasCompletedTodo: true });
    });
  });
}
