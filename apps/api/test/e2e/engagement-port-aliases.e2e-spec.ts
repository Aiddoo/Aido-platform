import {
  TODO_COMMENT_ACCOUNT_CLEANUP,
  TodoCommentAccountCleanupPort,
} from "#api/modules/engagement/comments/engagement-comments.public";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("engagement 공개 포트 별칭 (E2E)", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  });

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  it("옛 Symbol 토큰은 새 클래스 토큰과 같은 인스턴스를 준다(identity가 옮길 때까지)", () => {
    // When
    const isSameInstance =
      ctx.app.get(TodoCommentAccountCleanupPort) === ctx.app.get(TODO_COMMENT_ACCOUNT_CLEANUP);

    // Then
    expect(isSameInstance).toBe(true);
  });
});
