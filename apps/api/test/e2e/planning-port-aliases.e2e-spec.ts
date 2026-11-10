import {
  TODO_CATEGORY_READER,
  TodoCategoryReaderPort,
} from "#api/modules/planning/categories/planning-categories.public";
import {
  STAGED_TODO_CREATOR,
  StagedTodoCreatorPort,
  TODO_PLAN_READER,
  TodoPlanReaderPort,
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

  it("옛 Symbol 토큰은 새 클래스 토큰과 같은 인스턴스를 준다(ai·voice가 옮길 때까지)", () => {
    // Given
    const tokenPairs = [
      [StagedTodoCreatorPort, STAGED_TODO_CREATOR],
      [TodoPlanReaderPort, TODO_PLAN_READER],
      [TodoCategoryReaderPort, TODO_CATEGORY_READER],
    ] as const;

    // When
    const isSameInstance = tokenPairs.map(
      ([classToken, symbolToken]) => ctx.app.get(classToken) === ctx.app.get(symbolToken),
    );

    // Then
    expect(isSameInstance).toEqual(tokenPairs.map(() => true));
  });
});
