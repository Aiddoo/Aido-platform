import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { Friendship } from "../../../domain/aggregates/friends/friendship.aggregate.js";
import { type FollowNotifierPort } from "../../ports/friends/follow-notifier.port.js";
import { type FollowRepositoryPort } from "../../ports/friends/follow.repository.port.js";
import { FollowReader } from "../../services/friends/follow.reader.js";
import { FriendshipEffects } from "../../services/friends/friendship-effects.service.js";
import { SendFriendRequest } from "./send-friend-request.use-case.js";

const friendship = (
  followerId: string,
  followingId: string,
  status: "PENDING" | "ACCEPTED" = "PENDING",
): Friendship =>
  Friendship.reconstitute({
    id: "f-1",
    followerId,
    followingId,
    status,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

describe("SendFriendRequest", () => {
  let useCase: SendFriendRequest;
  let repo: Mocked<FollowRepositoryPort>;
  let notifier: Mocked<FollowNotifierPort>;
  let reader: Mocked<FollowReader>;
  let effects: Mocked<FriendshipEffects>;
  let entitlement: Mocked<ConstructorParameters<typeof SendFriendRequest>[0]["entitlementReader"]>;
  let uow: Mocked<UnitOfWorkPort>;

  beforeEach(async () => {
    const sendFriendRequestDependencies = mockDeep<
      ConstructorParameters<typeof SendFriendRequest>[0]
    >({});
    const unit = new SendFriendRequest(sendFriendRequestDependencies);
    useCase = unit;
    repo = sendFriendRequestDependencies.followRepository;
    notifier = sendFriendRequestDependencies.notifier;
    reader = sendFriendRequestDependencies.reader;
    effects = sendFriendRequestDependencies.effects;
    entitlement = sendFriendRequestDependencies.entitlementReader;
    uow = sendFriendRequestDependencies.unitOfWork;

    reader.countFriends.mockResolvedValue(0);
    entitlement.getResourceLimit.mockResolvedValue({
      maxCount: null,
      isAdmin: false,
      subscriptionStatus: "ACTIVE",
    });
    repo.userExists.mockResolvedValue(true);
    repo.getUserDisplayName.mockResolvedValue("name");
    uow.run.mockImplementation((work) => work());
  });

  it("자기 자신에게 요청하면 FOLLOW_0904", async () => {
    await expect(useCase.execute({ userId: "u1", targetUserId: "u1" })).rejects.toBeInstanceOf(
      ApplicationException,
    );
  });

  it("한도 초과면 FOLLOW_0909", async () => {
    reader.countFriends.mockResolvedValue(50);
    entitlement.getResourceLimit.mockResolvedValue({
      maxCount: 50,
      isAdmin: false,
      subscriptionStatus: "FREE",
    });
    await expect(useCase.execute({ userId: "u1", targetUserId: "u2" })).rejects.toBeInstanceOf(
      ApplicationException,
    );
  });

  it("대상이 없으면 FOLLOW_0905", async () => {
    repo.userExists.mockResolvedValue(false);
    await expect(useCase.execute({ userId: "u1", targetUserId: "u2" })).rejects.toBeInstanceOf(
      ApplicationException,
    );
  });

  it("이미 ACCEPTED면 FOLLOW_0902", async () => {
    repo.findByFollowerAndFollowing.mockResolvedValueOnce(friendship("u1", "u2", "ACCEPTED"));
    await expect(useCase.execute({ userId: "u1", targetUserId: "u2" })).rejects.toBeInstanceOf(
      ApplicationException,
    );
  });

  it("이미 PENDING이면 FOLLOW_0901", async () => {
    repo.findByFollowerAndFollowing.mockResolvedValueOnce(friendship("u1", "u2"));
    await expect(useCase.execute({ userId: "u1", targetUserId: "u2" })).rejects.toBeInstanceOf(
      ApplicationException,
    );
  });

  it("신규 요청은 PENDING 생성 + 새 팔로우 알림", async () => {
    repo.findByFollowerAndFollowing.mockResolvedValue(null);
    repo.create.mockResolvedValue(friendship("u1", "u2"));

    const result = await useCase.execute({ userId: "u1", targetUserId: "u2" });

    expect(result.autoAccepted).toBe(false);
    expect(result.follow.status).toBe("PENDING");
    expect(notifier.notifyFollowNew).toHaveBeenCalledWith(
      expect.objectContaining({ followerId: "u1", followingId: "u2" }),
    );
  });

  it("상대가 먼저 PENDING이면 자동 수락 + 맞팔 알림/캐시 무효화", async () => {
    repo.findByFollowerAndFollowing
      .mockResolvedValueOnce(null) // 내가 보낸 요청 없음
      .mockResolvedValueOnce(friendship("u2", "u1")); // 상대가 보낸 PENDING
    repo.getMaxSortOrderForFriends.mockResolvedValue(0);
    repo.create.mockResolvedValue(friendship("u1", "u2", "ACCEPTED"));

    const result = await useCase.execute({ userId: "u1", targetUserId: "u2" });

    expect(result.autoAccepted).toBe(true);
    expect(result.follow.status).toBe("ACCEPTED");
    expect(effects.notifyMutual).toHaveBeenCalledTimes(2);
    expect(effects.invalidateFriendshipCaches).toHaveBeenCalledWith("u1", "u2");
  });
});
