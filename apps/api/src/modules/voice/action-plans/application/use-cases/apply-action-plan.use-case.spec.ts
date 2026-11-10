import type { TodoRepeat } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { PlanMemo } from "#api/modules/notes/memos/notes-memos.public";
import type { StagedTodoCreatorPort } from "#api/modules/planning/todos/planning-todos.public";
import type { TodoReadModel } from "#api/modules/planning/todos/planning-todos.public";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { InMemoryPlanApplicationRepository } from "#test/doubles/voice/in-memory-plan-application.repository";
import { createTodoReadModelFixture } from "#test/fixtures/planning/todo-read-model.fixture";

import type { PlannedAction, PlannedTodo } from "../../domain/action-plan.vo.js";
import { ApplyActionPlanUseCase } from "./apply-action-plan.use-case.js";

const USER_ID = "user-1";
const MISSING_MEMO_ID = 404;

function todoAction(overrides: Partial<PlannedTodo> = {}): PlannedTodo {
  return {
    type: "CREATE_TODO",
    key: "todo-0",
    title: "회의록 보내기",
    categoryId: 1,
    startDate: "2027-01-04",
    endDate: null,
    scheduledTime: null,
    repeat: null,
    visibility: null,
    items: [],
    ...overrides,
  };
}

const memoAction: PlannedAction = {
  type: "CREATE_MEMO",
  key: "memo-0",
  title: "아이디어",
  content: "온보딩 문구",
};

function todoResponse(id: number): TodoReadModel {
  return createTodoReadModelFixture({ id, userId: USER_ID });
}

type StagedInput = Parameters<StagedTodoCreatorPort["stage"]>[0];

function setup(ownedCategoryIds: readonly number[] = [1]) {
  const order: string[] = [];
  const repository = new InMemoryPlanApplicationRepository();
  const stagedInputs: StagedInput[] = [];
  const registered: (() => Promise<void>)[] = [];
  const createdMemos: { userId: string; content: string }[] = [];
  const deletedMemoIds: number[] = [];
  const acquiredLocks: string[][] = [];
  const memo: PlanMemo = {
    id: 7,
    userId: USER_ID,
    content: "온보딩 문구",
    isPinned: false,
    sortOrder: 0,
    createdAt: "2027-01-04T00:00:00.000Z",
    updatedAt: "2027-01-04T00:00:00.000Z",
  };
  let nextTodoId = 100;
  const useCase = new ApplyActionPlanUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock: {
      acquire: async (keys) => {
        acquiredLocks.push([...keys]);
        order.push("lock");
      },
    },
    afterCommit: { register: (task) => registered.push(task) },
    repository: {
      findByIdempotencyKey: async (userId, key) => {
        order.push("findByKey");
        return repository.findByIdempotencyKey(userId, key);
      },
      save: async (application) => {
        order.push("insert");
        await repository.save(application);
      },
    },
    contextReader: {
      findOwnedCategoryIds: async () => {
        order.push("categories");
        return new Set(ownedCategoryIds);
      },
    },
    todoCreator: {
      stage: async (input) => {
        order.push("stage");
        stagedInputs.push(input);
        nextTodoId += 1;
        const first = todoResponse(nextTodoId);
        nextTodoId += 1;
        return {
          // 반복이면 회차 여러 개를 날짜순으로 돌려준다.
          todos: input.repeat == null ? [first] : [first, todoResponse(nextTodoId)],
          series: null,
          afterCommit: async () => undefined,
        };
      },
    },
    memoWriter: {
      create: async (input) => {
        order.push("memo");
        createdMemos.push({ userId: input.userId.value, content: input.content });
        return memo;
      },
      findById: async (memoId) => (memoId.value === MISSING_MEMO_ID ? null : memo),
      delete: async (memoId) => {
        order.push("deleteMemo");
        deletedMemoIds.push(memoId.value);
      },
    },
    todoReader: {
      findManyByIds: async (_userId, ids) => ids.map((id) => todoResponse(id)),
    },
    clock: new FixedClock(Temporal.Instant.from("2027-01-04T00:00:00Z")),
    logger: new SilentLogger(),
  });
  const execute = (actions: readonly PlannedAction[], idempotencyKey = "key-1") =>
    useCase.execute({
      userId: USER_ID,
      timezone: "Asia/Seoul",
      source: "QUICK_VOICE",
      sourceMemoId: undefined,
      actions,
      idempotencyKey,
    });
  const executeFromMemo = (memoId: number, actions: readonly PlannedAction[]) =>
    useCase.execute({
      userId: USER_ID,
      timezone: "Asia/Seoul",
      source: "MEMO",
      sourceMemoId: memoId,
      actions,
      idempotencyKey: "memo-key",
    });
  return {
    order,
    repository,
    stagedInputs,
    registered,
    createdMemos,
    deletedMemoIds,
    acquiredLocks,
    execute,
    executeFromMemo,
  };
}

describe("ApplyActionPlanUseCase", () => {
  it("잠금 → 멱등 확인 → 카테고리 확인 → 생성 → 기록 순서로 한 UoW에서 저장한다", async () => {
    // Given
    const { order, execute } = setup();
    // When
    await execute([todoAction(), memoAction]);
    // Then
    expect(order).toEqual(["lock", "findByKey", "categories", "stage", "memo", "insert"]);
  });

  it("손으로 만든 할 일과 같은 입력으로 생성 포트를 부르고 효과는 커밋 뒤로 등록한다", async () => {
    // Given
    const { stagedInputs, registered, execute } = setup();
    const scheduled = todoAction({
      scheduledTime: "15:30",
      endDate: "2027-01-06",
      visibility: "PRIVATE",
      items: [{ title: "슬라이드" }],
    });
    // When
    const result = await execute([scheduled, todoAction({ key: "todo-1" })]);
    // Then
    expect(stagedInputs[0]).toMatchObject({
      userId: USER_ID,
      timezone: "Asia/Seoul",
      title: "회의록 보내기",
      categoryId: 1,
      startDate: new Date("2027-01-04T00:00:00.000Z"),
      endDate: new Date("2027-01-06T00:00:00.000Z"),
      scheduledTime: "15:30",
      isAllDay: false,
      visibility: "PRIVATE",
      items: [{ title: "슬라이드" }],
    });
    expect(stagedInputs[1]).toMatchObject({
      endDate: null,
      scheduledTime: null,
      isAllDay: true,
      visibility: "PUBLIC",
    });
    expect(registered).toHaveLength(2);
    expect(result.todos).toHaveLength(2);
  });

  it("메모 제목은 메모 첫 줄이 된다", async () => {
    // Given
    const { createdMemos, execute } = setup();
    // When
    const result = await execute([memoAction]);
    // Then
    expect(createdMemos).toEqual([{ userId: USER_ID, content: "아이디어\n온보딩 문구" }]);
    expect(result.memo).toMatchObject({ id: 7 });
    expect(result.todos).toEqual([]);
  });

  it("내 카테고리가 아니면 아무것도 만들지 않고 AI_1315다", async () => {
    // Given
    const { order, execute } = setup([2]);
    // When
    const failure = execute([todoAction()]);
    // Then
    await expect(failure).rejects.toMatchObject({
      errorCode: ErrorCode.AI_1315,
      details: { reason: "CATEGORY_NOT_OWNED", categoryIds: [1] },
    });
    expect(order).not.toContain("stage");
    expect(order).not.toContain("insert");
  });

  it("같은 키의 재요청은 새로 만들지 않고 처음 저장한 결과를 돌려준다", async () => {
    // Given
    const { stagedInputs, createdMemos, execute } = setup();
    const first = await execute([todoAction(), memoAction]);
    // When
    const second = await execute([todoAction(), memoAction]);
    // Then
    expect(second.todos.map((todo) => todo.id)).toEqual(first.todos.map((todo) => todo.id));
    expect(second.memo).toMatchObject({ id: 7 });
    expect(stagedInputs).toHaveLength(1);
    expect(createdMemos).toHaveLength(1);
  });

  it("같은 키로 고친 내용을 보내면 AI_1318이고 만들지 않는다", async () => {
    // Given
    const { stagedInputs, execute } = setup();
    await execute([todoAction()]);
    // When
    const failure = execute([todoAction({ title: "고친 제목" })]);
    // Then
    await expect(failure).rejects.toMatchObject({
      errorCode: ErrorCode.AI_1318,
      details: { charged: false },
    });
    expect(stagedInputs).toHaveLength(1);
  });

  it("멱등 기록에는 사용자 글자 없이 id와 해시만 남긴다", async () => {
    // Given
    const { repository, execute } = setup();
    // When
    await execute([todoAction({ title: "비밀 제목" })]);
    // Then
    const [record] = repository.saved.map((application) => application.toPrimitives());
    expect(JSON.stringify(record)).not.toContain("비밀");
    expect(record?.requestHash).toMatch(/^[0-9a-f]{64}$/);
    expect(record?.todoIds).toHaveLength(1);
  });

  describe("메모에서 만든 계획", () => {
    it("메모 잠금을 잡고 할 일을 만든 뒤 원본 메모를 지운다", async () => {
      // Given
      const { order, acquiredLocks, deletedMemoIds, executeFromMemo } = setup();
      // When
      await executeFromMemo(7, [todoAction()]);
      // Then
      expect(acquiredLocks[0]).toContain("mutation:v1:memo:7");
      expect(order).toEqual(["lock", "findByKey", "categories", "stage", "deleteMemo", "insert"]);
      expect(deletedMemoIds).toEqual([7]);
    });

    it("없거나 남의 메모면 만들기 전에 MEMO_2001이다", async () => {
      // Given
      const { order, executeFromMemo } = setup();
      // When
      const failure = executeFromMemo(MISSING_MEMO_ID, [todoAction()]);
      // Then
      await expect(failure).rejects.toMatchObject({
        errorCode: ErrorCode.MEMO_2001,
        details: { memoId: MISSING_MEMO_ID },
      });
      expect(order).not.toContain("stage");
      expect(order).not.toContain("deleteMemo");
    });

    it("같은 키의 재요청은 메모를 다시 지우지 않고 처음 결과를 돌려준다", async () => {
      // Given
      const { deletedMemoIds, stagedInputs, executeFromMemo } = setup();
      const first = await executeFromMemo(7, [todoAction()]);
      // When
      const second = await executeFromMemo(7, [todoAction()]);
      // Then
      expect(second.todos.map((todo) => todo.id)).toEqual(first.todos.map((todo) => todo.id));
      expect(deletedMemoIds).toEqual([7]);
      expect(stagedInputs).toHaveLength(1);
    });
  });

  it("반복은 규칙을 그대로 넘기고 응답에는 첫 회차만 담는다", async () => {
    // Given
    const { stagedInputs, execute } = setup();
    const repeat: TodoRepeat = {
      frequency: "WEEKLY",
      interval: 2,
      weekdays: ["MON"],
      end: { type: "COUNT", count: 3 },
    };
    // When
    const result = await execute([todoAction({ repeat })]);
    // Then
    expect(stagedInputs[0]).toMatchObject({ repeat });
    expect(result.todos).toHaveLength(1);
  });
});
