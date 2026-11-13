import { ErrorCode } from "@aido/api/errors";
import { PLAN_CATALOG } from "@aido/api/vocabulary";
import { eq } from "drizzle-orm";

import { GetEntitlementUsageUseCase } from "#api/modules/access/entitlement-usage/application/use-cases/get-entitlement-usage.use-case";
import { CreateTodoCategoryUseCase } from "#api/modules/planning/categories/application/use-cases/create-todo-category.use-case";
import { TodoCategoryCountReaderPort } from "#api/modules/planning/categories/planning-categories.public";
import { SendFriendRequestUseCase } from "#api/modules/social/friends/application/use-cases/send-friend-request.use-case";
import { MutualFriendReaderPort } from "#api/modules/social/friends/social-friends.public";
import { follow, resourceBonus, todoCategory, user } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { FollowFixture, UserFixture } from "#test/fixtures/index";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../e2e/helpers/e2e-app-factory.js";

const AT = new Date("2027-01-04T12:00:00.000Z");
const FREE_CATEGORY_LIMIT = PLAN_CATALOG.TODO_CATEGORY.free;
const FREE_FRIEND_LIMIT = PLAN_CATALOG.FRIEND.free;

describe("권한 스냅샷의 친구·카테고리 개수는 한도 검사와 같은 값이다 (실제 PostgreSQL)", () => {
  let context: E2eTestContext;
  let categoryCountReader: TodoCategoryCountReaderPort;
  let friendCountReader: MutualFriendReaderPort;
  let getEntitlementUsage: GetEntitlementUsageUseCase;
  let userId: string;

  beforeAll(async () => {
    context = await createE2eApp();
    categoryCountReader = context.module.get(TodoCategoryCountReaderPort);
    friendCountReader = context.module.get(MutualFriendReaderPort);
    getEntitlementUsage = context.module.get(GetEntitlementUsageUseCase);
  });

  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT);
    const owner = UserFixture.create({
      createdAt: instantFromDate(AT),
      updatedAt: instantFromDate(AT),
    });
    await context.testDatabase.getClient().insert(user).values(owner);
    userId = owner.id;
  });

  afterEach(() => vi.useRealTimers());

  afterAll(async () => {
    if (context) {
      await destroyE2eApp(context);
    }
  });

  async function insertCategories(ownerId: string, count: number) {
    await context.testDatabase
      .getClient()
      .insert(todoCategory)
      .values(
        Array.from({ length: count }, (_, index) => ({
          userId: ownerId,
          name: `카테고리 ${index}`,
          color: "#FFB3B3",
          updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
          sortOrder: index,
        })),
      );
  }

  /** 서로 친구 count명과, 친구로 세지 않는 대기 요청·한쪽만 수락한 관계를 하나씩 만든다. */
  async function insertFriends(count: number) {
    const client = context.testDatabase.getClient();
    const others = Array.from({ length: count + 2 }, () => UserFixture.create());
    await client.insert(user).values(others);
    const friends = others.slice(0, count);
    const [pendingTarget, oneWayTarget] = others.slice(count);
    if (pendingTarget === undefined || oneWayTarget === undefined) {
      throw new Error("친구 fixture 사용자가 만들어지지 않았습니다.");
    }
    await client
      .insert(follow)
      .values([
        ...friends.flatMap((friend) =>
          Object.values(FollowFixture.createMutual(userId, friend.id)),
        ),
        FollowFixture.create({ followerId: userId, followingId: pendingTarget.id }),
        FollowFixture.createAccepted({ followerId: userId, followingId: oneWayTarget.id }),
      ]);
    return { target: pendingTarget };
  }

  function readEntitlementUsage() {
    return getEntitlementUsage.execute({ userId, timeZone: "Asia/Seoul" });
  }

  it("카테고리 개수는 다른 사용자 카테고리를 세지 않고, 한도에 닿으면 스냅샷과 만들기 거절이 같은 0을 말한다", async () => {
    // Given
    const other = UserFixture.create();
    await context.testDatabase.getClient().insert(user).values(other);
    await insertCategories(other.id, 2);
    await insertCategories(userId, FREE_CATEGORY_LIMIT);

    // When
    const count = await categoryCountReader.countCategories(UserId.reconstitute(userId));
    const { features } = await readEntitlementUsage();
    const creation = context.module
      .get(CreateTodoCategoryUseCase)
      .execute({ userId, name: "새 카테고리", color: "#112233" });

    // Then
    expect(count).toBe(FREE_CATEGORY_LIMIT);
    expect(features.TODO_CATEGORY).toMatchObject({
      limit: FREE_CATEGORY_LIMIT,
      used: FREE_CATEGORY_LIMIT,
      remaining: 0,
      resetsAt: null,
    });
    await expect(creation).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_CATEGORY_0857,
      details: { featureQuota: features.TODO_CATEGORY },
    });
  });

  it("친구 수는 서로 수락한 관계만 세고, 무료 한도에 닿으면 스냅샷과 친구 요청 거절이 같은 0을 말한다", async () => {
    // Given
    const { target } = await insertFriends(FREE_FRIEND_LIMIT);

    // When
    const count = await friendCountReader.countCurrentFriends(UserId.reconstitute(userId));
    const { features } = await readEntitlementUsage();
    const request = context.module
      .get(SendFriendRequestUseCase)
      .execute({ userId, targetUserId: target.id });

    // Then
    expect(count).toBe(FREE_FRIEND_LIMIT);
    expect(features.FRIEND).toMatchObject({
      limit: FREE_FRIEND_LIMIT,
      used: FREE_FRIEND_LIMIT,
      remaining: 0,
      resetsAt: null,
    });
    await expect(request).rejects.toMatchObject({
      errorCode: ErrorCode.FOLLOW_0909,
      details: { featureQuota: features.FRIEND },
    });
  });

  it("초대 보상 자리는 스냅샷 친구 한도에 더해져 한도 검사와 같은 남은 자리를 준다", async () => {
    // Given
    await insertFriends(FREE_FRIEND_LIMIT);
    await context.testDatabase
      .getClient()
      .insert(resourceBonus)
      .values([
        { userId, resource: "FRIEND", quantity: 1, sourceKey: "reward:test-1" },
        { userId, resource: "FRIEND", quantity: 1, sourceKey: "reward:test-2" },
      ]);

    // When
    const { features } = await readEntitlementUsage();

    // Then
    expect(features.FRIEND).toMatchObject({
      limit: FREE_FRIEND_LIMIT + 2,
      used: FREE_FRIEND_LIMIT,
      remaining: 2,
    });
  });

  it("프리미엄은 무제한 친구의 개수를 싣지 않고 카테고리는 프리미엄 한도로 센다", async () => {
    // Given
    await context.testDatabase
      .getClient()
      .update(user)
      .set({ subscriptionStatus: "ACTIVE" })
      .where(eq(user.id, userId));
    await insertFriends(2);
    await insertCategories(userId, FREE_CATEGORY_LIMIT);

    // When
    const { features } = await readEntitlementUsage();

    // Then
    expect(features.FRIEND).toMatchObject({ limit: null, used: null, remaining: null });
    expect(features.TODO_CATEGORY).toMatchObject({
      limit: PLAN_CATALOG.TODO_CATEGORY.premium,
      used: FREE_CATEGORY_LIMIT,
      remaining: PLAN_CATALOG.TODO_CATEGORY.premium - FREE_CATEGORY_LIMIT,
    });
  });
});
