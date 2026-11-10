import { EntitlementService } from "#api/modules/access/application/services/entitlement/entitlement.service";
import { FollowReaderPort } from "#api/modules/social/friends/application/ports/follow.reader.port";
import { PaginationService } from "#api/shared/application/pagination/index";
import type { UnitOfWorkPort, MutationLockPort } from "#api/shared/application/ports/index";
import { UserFixture } from "#test/fixtures/user.fixture";
import { FakeLogger } from "#test/mocks/fake-logger.service";
import { StubEntitlementCache, StubEntitlementDatabase } from "#test/mocks/ports/entitlement.stub";
import { StubUserBlockRepository } from "#test/mocks/ports/social-blocks.stub";
import {
  StubFollowCache,
  StubFollowNotifier,
  StubFollowRepository,
} from "#test/mocks/ports/social-friends.stub";

export const SOCIAL_TIME = new Date("2026-07-26T00:30:00.000Z");

// 옮기지 않은 social slice spec용이다. 운영 FollowReaderAdapter처럼 맞팔·친구 수·친구 id를 캐시를 거쳐 읽는다
class StubCachedFollowReader extends FollowReaderPort {
  readonly #followRepository: StubFollowRepository;
  readonly #cache: StubFollowCache;

  constructor(followRepository: StubFollowRepository, cache: StubFollowCache) {
    super();
    this.#followRepository = followRepository;
    this.#cache = cache;
  }

  async isMutualFriend(userId: string, targetUserId: string): Promise<boolean> {
    const cached = await this.#cache.getMutualFriend(userId, targetUserId);
    if (cached != null) {
      return cached;
    }
    const isMutual = await this.#followRepository.isMutualFriend(userId, targetUserId);
    await this.#cache.setMutualFriend(userId, targetUserId, isMutual);
    return isMutual;
  }

  isCurrentMutualFriend(userId: string, targetUserId: string): Promise<boolean> {
    return this.#followRepository.isMutualFriend(userId, targetUserId);
  }

  countFriends(userId: string): Promise<number> {
    return this.#cache.wrapFriendCount(userId, () =>
      this.#followRepository.countMutualFriends(userId),
    );
  }

  getUserDisplayName(userId: string): Promise<string> {
    return this.#followRepository.getUserDisplayName(userId);
  }

  getMutualFriendIds(userId: string): Promise<string[]> {
    return this.#cache.wrapMutualFriendIds(userId, () =>
      this.#followRepository.getMutualFriendIds(userId),
    );
  }

  getCurrentMutualFriendIds(userId: string): Promise<string[]> {
    return this.#followRepository.getMutualFriendIds(userId);
  }
}

export function createSocialFriendFixture() {
  const followRepository = new StubFollowRepository();
  const cache = new StubFollowCache();
  const userBlockRepository = new StubUserBlockRepository(followRepository);
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
  const reader = new StubCachedFollowReader(followRepository, cache);
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
    friendshipCache: cache,
    userBlockRepository,
    blockReader: userBlockRepository,
    notifier,
    database,
    entitlementReader,
    logger,
    paginationService,
    mutationLock,
    lockCalls,
    unitOfWork,
    reader,
    addUser,
    addMutual,
  };
}
