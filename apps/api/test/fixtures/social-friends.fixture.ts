import { EntitlementService } from "#api/modules/access/application/services/entitlement/entitlement.service";
import { FollowReader } from "#api/modules/social/application/services/friends/follow.reader";
import { FriendshipEffects } from "#api/modules/social/application/services/friends/friendship-effects.service";
import { PaginationService } from "#api/shared/application/pagination/index";
import type { UnitOfWorkPort, MutationLockPort } from "#api/shared/application/ports/index";
import { UserFixture } from "#test/fixtures/user.fixture";
import { FakeLogger } from "#test/mocks/fake-logger.service";
import { StubEntitlementCache, StubEntitlementDatabase } from "#test/mocks/ports/entitlement.stub";
import {
  StubFollowCache,
  StubFollowNotifier,
  StubFollowRepository,
} from "#test/mocks/ports/social-friends.stub";

export const SOCIAL_TIME = new Date("2026-07-26T00:30:00.000Z");

export function createSocialFriendFixture() {
  const followRepository = new StubFollowRepository();
  const cache = new StubFollowCache();
  const notifier = new StubFollowNotifier();
  const database = new StubEntitlementDatabase();
  const entitlementReader = new EntitlementService({
    database,
    cacheService: new StubEntitlementCache(),
  });
  const logger = new FakeLogger();
  const paginationService = new PaginationService();
  const lockCalls: string[][] = [];
  const mutationLock: MutationLockPort = {
    acquire: async (keys) => {
      lockCalls.push([...keys]);
    },
  };
  const unitOfWork: UnitOfWorkPort = { run: async (work) => work() };
  const reader = new FollowReader({ followRepository, cache });
  const effects = new FriendshipEffects({ followRepository, cache, notifier, logger });
  function addUser(
    id: string,
    profile: { name: string | null; profileImage: string | null } | null = {
      name: id,
      profileImage: null,
    },
  ) {
    const user = UserFixture.create({ id });
    followRepository.users.set(id, { id, userTag: user.userTag, profile });
    database.users.set(id, { role: user.role, subscriptionStatus: user.subscriptionStatus });
    return user;
  }
  function addMutual(userId: string, friendId: string, sortOrder = 0) {
    const follow = followRepository.seed({
      followerId: userId,
      followingId: friendId,
      status: "ACCEPTED",
      sortOrder,
    });
    followRepository.seed({
      followerId: friendId,
      followingId: userId,
      status: "ACCEPTED",
      sortOrder,
    });
    return follow;
  }
  return {
    followRepository,
    cache,
    notifier,
    database,
    entitlementReader,
    logger,
    paginationService,
    mutationLock,
    lockCalls,
    unitOfWork,
    reader,
    effects,
    addUser,
    addMutual,
  };
}
