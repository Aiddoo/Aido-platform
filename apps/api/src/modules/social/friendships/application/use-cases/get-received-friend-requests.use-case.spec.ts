import { InMemoryFriendProfileReader } from "#test/doubles/social/in-memory-friend-profile.reader";
import { InMemoryFriendReader } from "#test/doubles/social/in-memory-friend.reader";
import { InMemoryFriendshipRepository } from "#test/doubles/social/in-memory-friendship.repository";
import {
  createFriendshipFixture,
  createMutualFriendshipFixtures,
  FRIENDSHIP_FIXTURE_NOW,
  FRIENDSHIP_FIXTURE_USER_ID,
} from "#test/fixtures/social/friendship.fixture";

import { GetReceivedFriendRequestsUseCase } from "./get-received-friend-requests.use-case.js";
import { GetSentFriendRequestsUseCase } from "./get-sent-friend-requests.use-case.js";

const ME = FRIENDSHIP_FIXTURE_USER_ID;
const REQUESTERS = [
  "crequester00000000000001",
  "crequester00000000000002",
  "crequester00000000000003",
] as const;

function setup() {
  const friendshipRepository = new InMemoryFriendshipRepository([
    ...REQUESTERS.map((requesterId, index) =>
      createFriendshipFixture({
        followerId: requesterId,
        followingId: ME,
        createdAt: FRIENDSHIP_FIXTURE_NOW.add({ minutes: index }),
      }),
    ),
    createFriendshipFixture({ followerId: ME, followingId: REQUESTERS[0] }),
    ...createMutualFriendshipFixtures({ userId: ME, friendId: "cfriend000000000000000001" }),
  ]);
  const profileReader = new InMemoryFriendProfileReader();
  REQUESTERS.forEach((requesterId, index) => {
    profileReader.addUser({ id: requesterId, userTag: `REQS000${index}` });
  });
  profileReader.addUser({ id: "cfriend000000000000000001", userTag: "FRND0001" });
  const friendReader = new InMemoryFriendReader(friendshipRepository, profileReader);
  return {
    received: new GetReceivedFriendRequestsUseCase({ friendReader }),
    sent: new GetSentFriendRequestsUseCase({ friendReader }),
  };
}

describe("받은·보낸 친구 요청 목록", () => {
  it("받은 대기 요청을 최근 순으로 size만큼 주고 커서로 이어 주며 전체 개수를 함께 준다", async () => {
    // Given
    const { received } = setup();

    // When
    const first = await received.execute({ userId: ME, size: 2 });
    const next = await received.execute({
      userId: ME,
      size: 2,
      cursor: first.page.pagination.nextCursor ?? undefined,
    });

    // Then
    expect(first.page.items.map((request) => request.user.id)).toEqual([
      REQUESTERS[2],
      REQUESTERS[1],
    ]);
    expect(first.page.pagination.hasNext).toBe(true);
    expect(first.totalCount).toBe(3);
    expect(next.page.items.map((request) => request.user.id)).toEqual([REQUESTERS[0]]);
  });

  it("보낸 대기 요청은 받는 사람을 상대로 주고 친구 관계는 뺀다", async () => {
    // Given
    const { sent } = setup();

    // When
    const result = await sent.execute({ userId: ME });

    // Then
    expect(result.page.items.map((request) => request.user.id)).toEqual([REQUESTERS[0]]);
    expect(result.totalCount).toBe(1);
    expect(result.page.pagination).toEqual({ nextCursor: null, hasNext: false, size: 20 });
  });
});
