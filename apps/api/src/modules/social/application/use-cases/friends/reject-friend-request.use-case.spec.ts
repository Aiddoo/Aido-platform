import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createFollowRepositoryMock } from "#test/mocks/ports/follow.mock";

import { Friendship } from "../../../domain/aggregates/friends/friendship.aggregate.js";
import { type FollowRepositoryPort } from "../../ports/friends/follow.repository.port.js";
import { RejectFriendRequest } from "./reject-friend-request.use-case.js";

const ME = "u-me";
const REQUESTER = "u-req";

const friendship = (id: string, status: "PENDING" | "ACCEPTED" = "PENDING"): Friendship =>
  Friendship.reconstitute({
    id,
    followerId: REQUESTER,
    followingId: ME,
    status,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

describe("RejectFriendRequest — 친구 요청 거절", () => {
  let useCase: RejectFriendRequest;
  let repo: Mocked<FollowRepositoryPort>;

  beforeEach(async () => {
    const rejectFriendRequestDependencies = mockDeep<
      ConstructorParameters<typeof RejectFriendRequest>[0]
    >({ followRepository: createFollowRepositoryMock() });
    const unit = new RejectFriendRequest(rejectFriendRequestDependencies);
    useCase = unit;
    repo = rejectFriendRequestDependencies.followRepository;
  });

  it("받은 PENDING 요청이 없으면 FOLLOW_0903, 삭제하지 않는다", async () => {
    // Given
    repo.findByFollowerAndFollowing.mockResolvedValue(null);

    // When / Then
    await expect(useCase.execute({ userId: ME, requesterUserId: REQUESTER })).rejects.toMatchObject(
      { errorCode: "FOLLOW_0903" },
    );
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it("요청이 PENDING이 아니면(이미 ACCEPTED) FOLLOW_0903", async () => {
    // Given
    repo.findByFollowerAndFollowing.mockResolvedValue(friendship("req-1", "ACCEPTED"));

    // When / Then
    await expect(useCase.execute({ userId: ME, requesterUserId: REQUESTER })).rejects.toMatchObject(
      { errorCode: "FOLLOW_0903" },
    );
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it("PENDING 요청은 삭제한다", async () => {
    // Given
    repo.findByFollowerAndFollowing.mockResolvedValue(friendship("req-1"));

    // When
    await useCase.execute({ userId: ME, requesterUserId: REQUESTER });

    // Then
    expect(repo.findByFollowerAndFollowing).toHaveBeenCalledWith(REQUESTER, ME);
    expect(repo.delete).toHaveBeenCalledWith("req-1");
  });
});
