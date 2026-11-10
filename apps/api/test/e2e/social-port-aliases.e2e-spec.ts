import {
  USER_BLOCK_READER,
  UserBlockReaderPort,
} from "#api/modules/social/blocks/social-blocks.public";
import {
  FOLLOW_READER,
  FollowReaderPort,
  FRIEND_COUNT_READER,
  FriendCountReaderPort,
} from "#api/modules/social/friends/social-friends.public";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("social 공개 포트 별칭 (E2E)", () => {
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
      [FollowReaderPort, FOLLOW_READER],
      [FriendCountReaderPort, FRIEND_COUNT_READER],
      [UserBlockReaderPort, USER_BLOCK_READER],
    ] as const;

    // When
    const isSameInstance = tokenPairs.map(
      ([classToken, symbolToken]) => ctx.app.get(classToken) === ctx.app.get(symbolToken),
    );

    // Then
    expect(isSameInstance).toEqual([true, true, true]);
  });
});
