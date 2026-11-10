import type { TodoRepeat } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import { TodoCategoryId } from "#api/modules/planning/categories/planning-categories.public";
import { ApplicationException } from "#api/shared/application/application.exception";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemoryMemoRepository } from "#test/doubles/notes/in-memory-memo.repository";
import { FakeStagedTodoCreator } from "#test/doubles/planning/fake-staged-todo-creator";
import { ImmediateSavepointRunner } from "#test/doubles/platform/immediate-savepoint-runner";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingAfterCommitRegistry } from "#test/doubles/platform/recording-after-commit-registry";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  createMemoFixture,
  MEMO_FIXTURE_OTHER_USER_ID,
  MEMO_FIXTURE_USER_ID,
} from "#test/fixtures/notes/memo.fixture";
import { createTodoReadModelFixture } from "#test/fixtures/planning/todo-read-model.fixture";

import {
  type ConvertMemoToTodosDependencies,
  ConvertMemoToTodosUseCase,
} from "./convert-memo-to-todos.use-case.js";

const USER_ID = UserId.reconstitute(MEMO_FIXTURE_USER_ID);
const START_DATE = new Date("2026-11-10T00:00:00.000Z");
const REPEAT = {
  frequency: "WEEKLY",
  interval: 1,
  weekdays: ["MON", "WED"],
  end: { type: "UNTIL", date: "2026-11-30" },
} as const satisfies TodoRepeat;

// 작업이 throw 없이 끝나 커밋된 횟수만 센다(rollback이면 세지 않는다)
class CommitCountingUnitOfWork extends UnitOfWorkPort {
  commitCount = 0;

  async run<T>(work: () => Promise<T>): Promise<T> {
    const result = await work();
    this.commitCount += 1;
    return result;
  }
}

function createConvertMemoToTodosUseCase(overrides: Partial<ConvertMemoToTodosDependencies> = {}) {
  return new ConvertMemoToTodosUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock: new RecordingMutationLock(),
    savepointRunner: new ImmediateSavepointRunner(),
    afterCommit: new RecordingAfterCommitRegistry(),
    memoRepository: new InMemoryMemoRepository(),
    todoCreator: new FakeStagedTodoCreator(),
    logger: new SilentLogger(),
    ...overrides,
  });
}

describe("ConvertMemoToTodosUseCase — 메모를 여러 할 일로", () => {
  it("남의 메모는 MEMO_2001로 거절하고 어느 할 일도 만들지 않는다", async () => {
    // Given
    const foreign = createMemoFixture({ userId: MEMO_FIXTURE_OTHER_USER_ID });
    const todoCreator = new FakeStagedTodoCreator();
    const useCase = createConvertMemoToTodosUseCase({
      memoRepository: new InMemoryMemoRepository([foreign]),
      todoCreator,
    });

    // When
    const result = useCase.execute({
      userId: MEMO_FIXTURE_USER_ID,
      memoId: foreign.id.value,
      timezone: "Asia/Seoul",
      todos: [
        { title: "할 일", categoryId: TodoCategoryId.reconstitute(1), startDate: START_DATE },
      ],
    });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.MEMO_2001 });
    expect(todoCreator.inputs).toEqual([]);
  });

  it("단건·반복을 입력 순서대로 펼쳐 돌려주고 모두 성공하면 메모를 지운다", async () => {
    // Given
    const memo = createMemoFixture();
    const memoRepository = new InMemoryMemoRepository([memo]);
    const todoCreator = new FakeStagedTodoCreator();
    todoCreator.recurringTodos = [20, 21].map((id) =>
      createTodoReadModelFixture({ id, userId: MEMO_FIXTURE_USER_ID }),
    );
    const afterCommit = new RecordingAfterCommitRegistry();
    const useCase = createConvertMemoToTodosUseCase({ memoRepository, todoCreator, afterCommit });

    // When
    const todos = await useCase.execute({
      userId: MEMO_FIXTURE_USER_ID,
      memoId: memo.id.value,
      timezone: "Asia/Seoul",
      todos: [
        { title: "단건", categoryId: TodoCategoryId.reconstitute(1), startDate: START_DATE },
        {
          title: "반복",
          categoryId: TodoCategoryId.reconstitute(1),
          startDate: START_DATE,
          scheduledTime: null,
          isAllDay: false,
          visibility: "PRIVATE",
          repeat: REPEAT,
        },
      ],
    });

    // Then
    expect(todos.map((todo) => todo.id)).toEqual([1, 20, 21]);
    expect(todoCreator.inputs.at(1)).toEqual({
      userId: UserId.reconstitute(MEMO_FIXTURE_USER_ID),
      title: "반복",
      categoryId: TodoCategoryId.reconstitute(1),
      startDate: START_DATE,
      scheduledTime: null,
      timezone: "Asia/Seoul",
      isAllDay: false,
      visibility: "PRIVATE",
      repeat: REPEAT,
    });
    expect(afterCommit.tasks).toHaveLength(2);
    expect(await memoRepository.findByIdAndUserId(memo.id, USER_ID)).toBeNull();
  });

  it("뒤 항목이 실패하면 앞 항목은 커밋하고 그 작업만 등록한 뒤 원래 오류를 던지며 메모를 남긴다", async () => {
    // Given
    const memo = createMemoFixture();
    const memoRepository = new InMemoryMemoRepository([memo]);
    const failure = new ApplicationException(ErrorCode.TODO_CATEGORY_0851, { categoryId: 999 });
    const todoCreator = new FakeStagedTodoCreator();
    todoCreator.failure = (input) => (input.categoryId.value === 999 ? failure : null);
    const afterCommit = new RecordingAfterCommitRegistry();
    const unitOfWork = new CommitCountingUnitOfWork();
    const useCase = createConvertMemoToTodosUseCase({
      unitOfWork,
      memoRepository,
      todoCreator,
      afterCommit,
    });

    // When
    const result = useCase.execute({
      userId: MEMO_FIXTURE_USER_ID,
      memoId: memo.id.value,
      timezone: "Asia/Seoul",
      todos: [
        { title: "성공", categoryId: TodoCategoryId.reconstitute(1), startDate: START_DATE },
        { title: "실패", categoryId: TodoCategoryId.reconstitute(999), startDate: START_DATE },
        {
          title: "실행하지 않음",
          categoryId: TodoCategoryId.reconstitute(1),
          startDate: START_DATE,
        },
      ],
    });

    // Then
    await expect(result).rejects.toBe(failure);
    expect(unitOfWork.commitCount).toBe(1);
    expect(todoCreator.inputs.map((input) => input.title)).toEqual(["성공"]);
    expect(afterCommit.tasks).toHaveLength(1);
    expect(await memoRepository.findByIdAndUserId(memo.id, USER_ID)).not.toBeNull();
  });
});
