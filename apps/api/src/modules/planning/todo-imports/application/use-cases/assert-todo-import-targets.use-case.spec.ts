import { ErrorCode } from "@aido/api/errors";
import { PLAN_CATALOG, TODO_LIMITS } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FakeTodoImportCategories } from "#test/doubles/planning/fake-todo-import-categories";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { createEntitlementFixture } from "#test/fixtures/access/entitlement.fixture";
import {
  hashedKey,
  TODO_IMPORT_FIXTURE_NOW,
  TODO_IMPORT_FIXTURE_USER_ID,
} from "#test/fixtures/planning/todo-import.fixture";

import { TodoImportCollection } from "../../domain/todo-import-collection.vo.js";
import {
  TodoImportTarget,
  type TodoImportTargetPrimitives,
} from "../../domain/todo-import-target.vo.js";
import { AssertTodoImportTargetsUseCase } from "./assert-todo-import-targets.use-case.js";

const USER_ID = UserId.reconstitute(TODO_IMPORT_FIXTURE_USER_ID);
const FREE_CATEGORY_LIMIT = PLAN_CATALOG.TODO_CATEGORY.free;

function setUp(categories: readonly { id: number; name: string; usage?: number }[]) {
  const fake = new FakeTodoImportCategories(categories);
  const entitlements = createEntitlementFixture(
    { subscriptionStatus: "FREE" },
    { clock: new FixedClock(TODO_IMPORT_FIXTURE_NOW) },
  );
  return new AssertTodoImportTargetsUseCase({
    categoryReader: fake.reader,
    categoryUsageReader: fake.usageReader,
    entitlementReader: entitlements.reader,
  });
}

function commandOf(
  entries: readonly { readonly target: TodoImportTargetPrimitives; readonly expected: number }[],
) {
  return {
    userId: USER_ID,
    targets: entries.map(({ target }) => TodoImportTarget.create(target)),
    collections: entries.map(({ target, expected }) =>
      TodoImportCollection.create({
        collectionKey: hashedKey(target.targetKey),
        targetKey: target.targetKey,
        expectedItemCount: expected,
      }),
    ),
  };
}

describe("AssertTodoImportTargetsUseCase", () => {
  it("이름 중복·없는 카테고리·자리 부족을 대상마다 모아 2303 하나로 알린다", async () => {
    // Given
    const useCase = setUp([
      { id: 1, name: "업무", usage: 290 },
      { id: 2, name: "개인", usage: 0 },
    ]);

    // When
    const result = useCase.execute(
      commandOf([
        {
          target: {
            kind: "NEW_CATEGORY",
            targetKey: "dup",
            name: "개인",
            color: "#FF0000",
            categoryId: null,
          },
          expected: 1,
        },
        { target: { kind: "EXISTING_CATEGORY", targetKey: "gone", categoryId: 999 }, expected: 1 },
        { target: { kind: "EXISTING_CATEGORY", targetKey: "full", categoryId: 1 }, expected: 11 },
        { target: { kind: "EXISTING_CATEGORY", targetKey: "ok", categoryId: 2 }, expected: 300 },
      ]),
    );

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_IMPORT_2303,
      details: {
        targets: [
          { targetKey: "dup", reason: "CATEGORY_NAME_TAKEN" },
          { targetKey: "gone", reason: "CATEGORY_NOT_FOUND" },
          {
            targetKey: "full",
            reason: "CAPACITY",
            current: 290,
            expected: 11,
            limit: TODO_LIMITS.MAX_PER_CATEGORY,
          },
        ],
      },
    });
  });

  it("새 카테고리를 만들면 무료 카테고리 수 한도를 넘을 때 카테고리 만들기와 같은 0857이다", async () => {
    // Given
    const useCase = setUp([
      { id: 1, name: "업무" },
      { id: 2, name: "개인" },
    ]);
    const newTarget = (index: number) => ({
      target: {
        kind: "NEW_CATEGORY" as const,
        targetKey: `new-${index}`,
        name: `캘린더 ${index}`,
        color: "#FF0000",
        categoryId: null,
      },
      expected: 1,
    });

    // When
    const within = useCase.execute(commandOf([newTarget(1)]));
    const over = useCase.execute(commandOf([newTarget(1), newTarget(2)]));

    // Then
    await expect(within).resolves.toBeUndefined();
    await expect(over).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_CATEGORY_0857,
      details: {
        charged: false,
        featureQuota: { feature: "TODO_CATEGORY", limit: FREE_CATEGORY_LIMIT, used: 2 },
      },
    });
  });
});
