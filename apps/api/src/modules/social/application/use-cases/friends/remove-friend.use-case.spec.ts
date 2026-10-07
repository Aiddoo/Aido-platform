import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { createFollowRepositoryMock } from "#test/mocks/ports/follow.mock";
import { createUnitOfWorkMock } from "#test/mocks/ports/index";

import { Friendship } from "../../../domain/aggregates/friends/friendship.aggregate.js";
import { type FollowRepositoryPort } from "../../ports/friends/follow.repository.port.js";
import { FriendshipEffects } from "../../services/friends/friendship-effects.service.js";
import { RemoveFriend } from "./remove-friend.use-case.js";

const ME = "u-me";
const TARGET = "u-target";

const friendship = (id: string, followerId: string, followingId: string): Friendship =>
  Friendship.reconstitute({
    id,
    followerId,
    followingId,
    status: "ACCEPTED",
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

describe("RemoveFriend — 친구 삭제/요청 철회", () => {
  let useCase: RemoveFriend;
  let repo: Mocked<FollowRepositoryPort>;
  let uow: Mocked<UnitOfWorkPort>;
  let effects: Mocked<FriendshipEffects>;

  beforeEach(async () => {
    const removeFriendDependencies = mockDeep<ConstructorParameters<typeof RemoveFriend>[0]>({
      followRepository: createFollowRepositoryMock(),
      unitOfWork: createUnitOfWorkMock(),
    });
    const unit = new RemoveFriend(removeFriendDependencies);
    useCase = unit;
    repo = removeFriendDependencies.followRepository;
    uow = removeFriendDependencies.unitOfWork;
    effects = removeFriendDependencies.effects;
  });

  it("내 방향 관계가 없으면 FOLLOW_0907, 트랜잭션 미실행", async () => {
    // Given
    repo.findByFollowerAndFollowing.mockResolvedValue(null);

    // When / Then
    await expect(useCase.execute({ userId: ME, targetUserId: TARGET })).rejects.toMatchObject({
      errorCode: "FOLLOW_0907",
    });
    expect(uow.run).not.toHaveBeenCalled();
    expect(effects.invalidateFriendshipCaches).not.toHaveBeenCalled();
  });

  it("양방향 관계를 모두 삭제하고 캐시를 무효화한다", async () => {
    // Given
    repo.findByFollowerAndFollowing
      .mockResolvedValueOnce(friendship("my-1", ME, TARGET)) // 내 방향
      .mockResolvedValueOnce(friendship("their-1", TARGET, ME)); // 상대 방향

    // When
    await useCase.execute({ userId: ME, targetUserId: TARGET });

    // Then
    expect(repo.delete).toHaveBeenCalledWith("my-1");
    expect(repo.delete).toHaveBeenCalledWith("their-1");
    expect(repo.delete).toHaveBeenCalledTimes(2);
    expect(effects.invalidateFriendshipCaches).toHaveBeenCalledWith(ME, TARGET);
  });

  it("상대 방향 관계가 없으면 내 방향만 삭제한다", async () => {
    // Given
    repo.findByFollowerAndFollowing
      .mockResolvedValueOnce(friendship("my-1", ME, TARGET)) // 내 방향
      .mockResolvedValueOnce(null); // 상대 방향 없음

    // When
    await useCase.execute({ userId: ME, targetUserId: TARGET });

    // Then
    expect(repo.delete).toHaveBeenCalledWith("my-1");
    expect(repo.delete).toHaveBeenCalledTimes(1);
  });

  it("캐시 무효화는 트랜잭션 커밋 이후 수행된다", async () => {
    // Given
    repo.findByFollowerAndFollowing
      .mockResolvedValueOnce(friendship("my-1", ME, TARGET))
      .mockResolvedValueOnce(null);

    // When
    await useCase.execute({ userId: ME, targetUserId: TARGET });

    // Then
    const runOrder = uow.run.mock.invocationCallOrder[0] ?? 0;
    const invalidateOrder = effects.invalidateFriendshipCaches.mock.invocationCallOrder[0] ?? 0;
    expect(invalidateOrder).toBeGreaterThan(runOrder);
  });
});
