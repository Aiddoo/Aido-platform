import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import {
  type FollowRepositoryPort,
  type FollowWithUser,
} from "../../ports/friends/follow.repository.port.js";
import type { FriendshipEffects } from "../../services/friends/friendship-effects.service.js";

export interface AcceptFriendRequestInput {
  userId: string;
  requesterUserId: string;
}

/**
 * 친구 요청 수락 use-case.
 *
 * 받은 PENDING 요청을 ACCEPTED로 바꾸고, 역방향 관계도 생성/갱신해 양방향 친구를 성립시킨다.
 * 반환값은 "나 -> 상대방" 방향의 FollowWithUser(컨트롤러가 friend로 매핑).
 */
interface AcceptFriendRequestDependencies {
  readonly followRepository: FollowRepositoryPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly effects: FriendshipEffects;
  readonly logger: ApplicationLogger;
}

export class AcceptFriendRequest {
  readonly #dependencies: AcceptFriendRequestDependencies;

  constructor(dependencies: AcceptFriendRequestDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: AcceptFriendRequestInput): Promise<FollowWithUser> {
    const { userId, requesterUserId } = input;

    const request = await this.#dependencies.followRepository.findByFollowerAndFollowing(
      requesterUserId,
      userId,
    );
    if (!request?.isPending()) {
      throw new ApplicationException(ErrorCode.FOLLOW_0903, {
        targetUserId: requesterUserId,
      });
    }

    const myFollow = await this.#dependencies.unitOfWork.run(async () => {
      const [maxSortUser, maxSortRequester] = await Promise.all([
        this.#dependencies.followRepository.getMaxSortOrderForFriends(userId),
        this.#dependencies.followRepository.getMaxSortOrderForFriends(requesterUserId),
      ]);

      request.accept(maxSortRequester + 1);
      await this.#dependencies.followRepository.update(request.id, request.toUpdate());

      const existingReverse = await this.#dependencies.followRepository.findByFollowerAndFollowing(
        userId,
        requesterUserId,
      );

      if (existingReverse) {
        existingReverse.accept(maxSortUser + 1);
      }

      const createdFollow = existingReverse
        ? await this.#dependencies.followRepository.update(
            existingReverse.id,
            existingReverse.toUpdate(),
          )
        : await this.#dependencies.followRepository.create({
            followerId: userId,
            followingId: requesterUserId,
            status: "ACCEPTED",
            sortOrder: maxSortUser + 1,
          });

      const followWithUser = await this.#dependencies.followRepository.findByIdWithUser(
        createdFollow.id,
      );
      if (!followWithUser) {
        throw new ApplicationException(ErrorCode.SYS_0001, {
          detail: "Failed to retrieve created follow with user info",
          context: { followId: createdFollow.id, userId, requesterUserId },
        });
      }
      return followWithUser;
    });

    this.#dependencies.logger.log(`Friend request accepted: ${requesterUserId} <-> ${userId}`);

    await this.#dependencies.effects.invalidateFriendshipCaches(userId, requesterUserId);

    const userName = myFollow.follower.profile?.name ?? myFollow.follower.userTag;
    const requesterName = myFollow.following.profile?.name ?? myFollow.following.userTag;

    this.#dependencies.effects.notifyMutual({
      userId,
      friendId: requesterUserId,
      friendName: requesterName,
    });
    this.#dependencies.effects.notifyMutual({
      userId: requesterUserId,
      friendId: userId,
      friendName: userName,
    });

    await Promise.all([
      this.#dependencies.effects.checkFirstFriendMilestone(userId),
      this.#dependencies.effects.checkFirstFriendMilestone(requesterUserId),
    ]);

    return myFollow;
  }
}
