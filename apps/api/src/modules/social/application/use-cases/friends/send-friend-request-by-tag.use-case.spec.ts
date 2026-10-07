import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createFollowRepositoryMock } from "#test/mocks/ports/follow.mock";

import { Friendship } from "../../../domain/aggregates/friends/friendship.aggregate.js";
import { type FollowRepositoryPort } from "../../ports/friends/follow.repository.port.js";
import { SendFriendRequestByTag } from "./send-friend-request-by-tag.use-case.js";
import { type SendFriendRequestResult, SendFriendRequest } from "./send-friend-request.use-case.js";

const ME = "u-me";
const TARGET_ID = "u-target";
const VALID_TAG = "ABCD1234";

const sentResult: SendFriendRequestResult = {
  follow: Friendship.reconstitute({
    id: "f-1",
    followerId: ME,
    followingId: TARGET_ID,
    status: "PENDING",
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  autoAccepted: false,
};

describe("SendFriendRequestByTag — 태그로 친구 요청", () => {
  let useCase: SendFriendRequestByTag;
  let repo: Mocked<FollowRepositoryPort>;
  let sendFriendRequest: Mocked<SendFriendRequest>;

  beforeEach(async () => {
    const sendFriendRequestByTagDependencies = mockDeep<
      ConstructorParameters<typeof SendFriendRequestByTag>[0]
    >({ followRepository: createFollowRepositoryMock() });
    const unit = new SendFriendRequestByTag(sendFriendRequestByTagDependencies);
    useCase = unit;
    repo = sendFriendRequestByTagDependencies.followRepository;
    sendFriendRequest = sendFriendRequestByTagDependencies.sendFriendRequest;
  });

  it("형식이 잘못된 태그는 SYS_0002로 거부하고 조회하지 않는다", async () => {
    // When / Then
    await expect(useCase.execute({ userId: ME, targetUserTag: "bad" })).rejects.toMatchObject({
      errorCode: "SYS_0002",
    });
    expect(repo.findUserByTag).not.toHaveBeenCalled();
  });

  it("태그에 해당하는 사용자가 없으면 FOLLOW_0905, 위임하지 않는다", async () => {
    // Given
    repo.findUserByTag.mockResolvedValue(null);

    // When / Then
    await expect(useCase.execute({ userId: ME, targetUserTag: VALID_TAG })).rejects.toMatchObject({
      errorCode: "FOLLOW_0905",
    });
    expect(sendFriendRequest.execute).not.toHaveBeenCalled();
  });

  it("태그를 사용자 ID로 해석해 SendFriendRequest에 위임한다", async () => {
    // Given
    repo.findUserByTag.mockResolvedValue({ id: TARGET_ID });
    sendFriendRequest.execute.mockResolvedValue(sentResult);

    // When
    const result = await useCase.execute({
      userId: ME,
      targetUserTag: VALID_TAG,
    });

    // Then
    expect(repo.findUserByTag).toHaveBeenCalledWith(VALID_TAG);
    expect(sendFriendRequest.execute).toHaveBeenCalledWith({
      userId: ME,
      targetUserId: TARGET_ID,
    });
    expect(result).toBe(sentResult);
  });
});
