import {
  TODO_CATEGORY_COUNT_READER,
  TODO_CATEGORY_PROVISIONER,
  TODO_CATEGORY_READER,
  TodoCategoryCountReaderPort,
  TodoCategoryProvisionerPort,
  TodoCategoryReaderPort,
} from "#api/modules/planning/categories/planning-categories.public";
import {
  STAGED_TODO_CREATOR,
  StagedTodoCreatorPort,
  TODO_PLAN_READER,
  TODO_VIEW_CACHE_INVALIDATOR,
  TodoPlanReaderPort,
  TodoViewCacheInvalidatorPort,
} from "#api/modules/planning/todos/planning-todos.public";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("planning 공개 포트 별칭 (E2E)", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  });

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  it("옛 Symbol 토큰은 새 클래스 토큰과 같은 인스턴스를 준다(소비 Context가 옮길 때까지)", () => {
    // Given
    const tokenPairs = [
      [StagedTodoCreatorPort, STAGED_TODO_CREATOR],
      [TodoPlanReaderPort, TODO_PLAN_READER],
      [TodoViewCacheInvalidatorPort, TODO_VIEW_CACHE_INVALIDATOR],
      [TodoCategoryReaderPort, TODO_CATEGORY_READER],
      [TodoCategoryCountReaderPort, TODO_CATEGORY_COUNT_READER],
      [TodoCategoryProvisionerPort, TODO_CATEGORY_PROVISIONER],
    ] as const;

    // When
    const isSameInstance = tokenPairs.map(
      ([classToken, symbolToken]) => ctx.app.get(classToken) === ctx.app.get(symbolToken),
    );

    // Then
    expect(isSameInstance).toEqual(tokenPairs.map(() => true));
  });
});
