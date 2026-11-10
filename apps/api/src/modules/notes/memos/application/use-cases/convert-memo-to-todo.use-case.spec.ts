import { ErrorCode } from "@aido/api/errors";

import { TodoCategoryId } from "#api/modules/planning/categories/planning-categories.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemoryMemoRepository } from "#test/doubles/notes/in-memory-memo.repository";
import { FakeStagedTodoCreator } from "#test/doubles/planning/fake-staged-todo-creator";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingAfterCommitRegistry } from "#test/doubles/platform/recording-after-commit-registry";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  createMemoFixture,
  MEMO_FIXTURE_OTHER_USER_ID,
  MEMO_FIXTURE_USER_ID,
} from "#test/fixtures/notes/memo.fixture";

import {
  type ConvertMemoToTodoDependencies,
  ConvertMemoToTodoUseCase,
} from "./convert-memo-to-todo.use-case.js";

const USER_ID = UserId.reconstitute(MEMO_FIXTURE_USER_ID);
const START_DATE = new Date("2026-11-10T00:00:00.000Z");

function createConvertMemoToTodoUseCase(overrides: Partial<ConvertMemoToTodoDependencies> = {}) {
  return new ConvertMemoToTodoUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock: new RecordingMutationLock(),
    afterCommit: new RecordingAfterCommitRegistry(),
    memoRepository: new InMemoryMemoRepository(),
    todoCreator: new FakeStagedTodoCreator(),
    logger: new SilentLogger(),
    ...overrides,
  });
}

describe("ConvertMemoToTodoUseCase — 메모를 할 일 하나로", () => {
  it("남의 메모는 MEMO_2001로 거절하고 할 일·커밋 뒤 작업을 만들지 않는다", async () => {
    // Given
    const foreign = createMemoFixture({ userId: MEMO_FIXTURE_OTHER_USER_ID });
    const memoRepository = new InMemoryMemoRepository([foreign]);
    const todoCreator = new FakeStagedTodoCreator();
    const afterCommit = new RecordingAfterCommitRegistry();
    const useCase = createConvertMemoToTodoUseCase({ memoRepository, todoCreator, afterCommit });

    // When
    const result = useCase.execute({
      userId: MEMO_FIXTURE_USER_ID,
      memoId: foreign.id.value,
      timezone: "Asia/Seoul",
      todo: { categoryId: TodoCategoryId.reconstitute(1), startDate: START_DATE },
    });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.MEMO_2001 });
    expect(todoCreator.inputs).toEqual([]);
    expect(afterCommit.tasks).toEqual([]);
    expect(memoRepository.size).toBe(1);
  });

  it("앞 200자를 제목으로 넘기고 생략한 종일·공개 기본값을 채운 뒤 메모를 지운다", async () => {
    // Given
    const memo = createMemoFixture({ content: "가".repeat(300) });
    const memoRepository = new InMemoryMemoRepository([memo]);
    const todoCreator = new FakeStagedTodoCreator();
    const afterCommit = new RecordingAfterCommitRegistry();
    const useCase = createConvertMemoToTodoUseCase({ memoRepository, todoCreator, afterCommit });

    // When
    const todo = await useCase.execute({
      userId: MEMO_FIXTURE_USER_ID,
      memoId: memo.id.value,
      timezone: "Asia/Seoul",
      todo: {
        categoryId: TodoCategoryId.reconstitute(1),
        startDate: START_DATE,
        items: [{ title: "준비" }],
      },
    });

    // Then
    expect(todoCreator.inputs).toEqual([
      {
        userId: UserId.reconstitute(MEMO_FIXTURE_USER_ID),
        title: "가".repeat(200),
        categoryId: TodoCategoryId.reconstitute(1),
        startDate: START_DATE,
        timezone: "Asia/Seoul",
        isAllDay: true,
        visibility: "PUBLIC",
        items: [{ title: "준비" }],
      },
    ]);
    expect(await memoRepository.findByIdAndUserId(memo.id, USER_ID)).toBeNull();
    expect(todoCreator.settledTodoIds).toEqual([]);
    await afterCommit.runAll();
    expect(todoCreator.settledTodoIds).toEqual([todo.id]);
  });

  it("할 일 만들기가 실패하면 원래 오류를 그대로 던지고 메모를 남긴다", async () => {
    // Given
    const memo = createMemoFixture();
    const memoRepository = new InMemoryMemoRepository([memo]);
    const failure = new Error("할 일 저장 실패");
    const todoCreator = new FakeStagedTodoCreator();
    todoCreator.failure = () => failure;
    const afterCommit = new RecordingAfterCommitRegistry();
    const useCase = createConvertMemoToTodoUseCase({ memoRepository, todoCreator, afterCommit });

    // When
    const result = useCase.execute({
      userId: MEMO_FIXTURE_USER_ID,
      memoId: memo.id.value,
      timezone: "Asia/Seoul",
      todo: { categoryId: TodoCategoryId.reconstitute(1), startDate: START_DATE },
    });

    // Then
    await expect(result).rejects.toBe(failure);
    expect(await memoRepository.findByIdAndUserId(memo.id, USER_ID)).not.toBeNull();
    expect(afterCommit.tasks).toEqual([]);
  });
});
