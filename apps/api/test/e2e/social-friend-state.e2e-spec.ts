import type { FriendUser } from "@aido/api";
import { and } from "@prisma/orm-postgres/orm-client";
import request from "supertest";

import { SOCIAL_TIME } from "#test/fixtures/social-friends.fixture";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("친구 상태 변경 HTTP 계약", () => {
  let context: E2eTestContext;
  beforeAll(async () => {
    context = await createE2eApp();
  });
  afterAll(async () => {
    vi.useRealTimers();
    await destroyE2eApp(context);
  });
  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SOCIAL_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("같은 요청을 동시에 수락하면 한 요청만 성공하고 상대방 관계는 하나만 생긴다", async () => {
    // Given
    const requester = await context.helpers.createVerifiedUser(
      "friend-state-requester@test.com",
      "Test1234!",
    );
    const receiver = await context.helpers.createVerifiedUser(
      "friend-state-receiver@test.com",
      "Test1234!",
    );
    await request(context.app.getHttpServer())
      .post(`/v1/follows/${receiver.userTag}`)
      .set("Authorization", `Bearer ${requester.accessToken}`)
      .expect(201);
    // When
    const responses = await Promise.all(
      [1, 2].map(() =>
        request(context.app.getHttpServer())
          .patch(`/v1/follows/${requester.userId}/accept`)
          .set("Authorization", `Bearer ${receiver.accessToken}`),
      ),
    );
    // Then
    expect(responses.map((response) => response.status).sort()).toEqual([200, 404]);
    const rejected = responses.find((response) => response.status === 404);
    expect(rejected?.body.error.code).toBe("FOLLOW_0903");
    const database = context.testDatabase.getClient();
    expect(
      await database.orm.public.Follow.where((row) =>
        and(
          row.followerId.eq(requester.userId),
          row.followingId.eq(receiver.userId),
          row.status.eq("ACCEPTED"),
        ),
      ).aggregate((aggregate) => ({ count: aggregate.count() })),
    ).toEqual({ count: 1 });
    expect(
      await database.orm.public.Follow.where((row) =>
        and(
          row.followerId.eq(receiver.userId),
          row.followingId.eq(requester.userId),
          row.status.eq("ACCEPTED"),
        ),
      ).aggregate((aggregate) => ({ count: aggregate.count() })),
    ).toEqual({ count: 1 });
    const list = await request(context.app.getHttpServer())
      .get("/v1/follows/friends")
      .set("Authorization", `Bearer ${receiver.accessToken}`)
      .expect(200);
    expect(list.body.data.friends.map((friend: FriendUser) => friend.id)).toEqual([
      requester.userId,
    ]);
    expect(list.body.data.totalCount).toBe(1);
  });

  it("정렬 PATCH는 기존 친구 응답을 유지하고 내 목록의 순서만 변경한다", async () => {
    // Given
    const owner = await context.helpers.createVerifiedUser(
      "friend-state-owner@test.com",
      "Test1234!",
    );
    const first = await context.helpers.createVerifiedUser(
      "friend-state-first@test.com",
      "Test1234!",
    );
    const second = await context.helpers.createVerifiedUser(
      "friend-state-second@test.com",
      "Test1234!",
    );
    for (const friend of [first, second]) {
      await request(context.app.getHttpServer())
        .post(`/v1/follows/${owner.userTag}`)
        .set("Authorization", `Bearer ${friend.accessToken}`)
        .expect(201);
      await request(context.app.getHttpServer())
        .patch(`/v1/follows/${friend.userId}/accept`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .expect(200);
    }
    const initial = await request(context.app.getHttpServer())
      .get("/v1/follows/friends")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);
    const friends: FriendUser[] = initial.body.data.friends;
    const firstFollowId = friends.find((friend) => friend.id === first.userId)?.followId;
    const secondFollowId = friends.find((friend) => friend.id === second.userId)?.followId;
    expect(firstFollowId).toBeDefined();
    expect(secondFollowId).toBeDefined();
    if (firstFollowId === undefined || secondFollowId === undefined)
      throw new Error("생성한 친구 관계가 목록에 없습니다.");
    // When
    const moved = await request(context.app.getHttpServer())
      .patch(`/v1/follows/friends/${secondFollowId}/reorder`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ targetFollowId: firstFollowId, position: "before" })
      .expect(200);
    // Then
    expect(moved.body.data.friend).toMatchObject({
      id: second.userId,
      followId: secondFollowId,
      userTag: second.userTag,
    });
    const reordered = await request(context.app.getHttpServer())
      .get("/v1/follows/friends")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(reordered.body.data.friends.map((friend: FriendUser) => friend.id)).toEqual([
      second.userId,
      first.userId,
    ]);
    const reverse = await request(context.app.getHttpServer())
      .get("/v1/follows/friends")
      .set("Authorization", `Bearer ${first.accessToken}`)
      .expect(200);
    expect(reverse.body.data.friends.map((friend: FriendUser) => friend.id)).toEqual([
      owner.userId,
    ]);
    const database = context.testDatabase.getClient();
    const beforeNoop = await database.orm.public.Follow.where((row) => row.id.eq(secondFollowId))
      .select("sortOrder", "updatedAt")
      .first();
    vi.setSystemTime(new Date(SOCIAL_TIME.getTime() + 60000));
    await request(context.app.getHttpServer())
      .patch(`/v1/follows/friends/${secondFollowId}/reorder`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ targetFollowId: secondFollowId, position: "before" })
      .expect(200);
    expect(
      await database.orm.public.Follow.where((row) => row.id.eq(secondFollowId))
        .select("sortOrder", "updatedAt")
        .first(),
    ).toEqual(beforeNoop);
    await request(context.app.getHttpServer())
      .patch(`/v1/follows/friends/${secondFollowId}/reorder`)
      .set("Authorization", `Bearer ${first.accessToken}`)
      .send({ position: "before" })
      .expect(404)
      .expect((response) => {
        expect(response.body.error.code).toBe("FOLLOW_0910");
      });
    expect(
      await database.orm.public.Follow.where((row) => row.id.eq(secondFollowId))
        .select("sortOrder", "updatedAt")
        .first(),
    ).toEqual(beforeNoop);
  });
});
