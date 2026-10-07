import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { SocialFriendLogEvent } from "../../observability/friends/social-friend-log.events.js";
import {
  type FollowRepositoryPort,
  type FollowWithUser,
} from "../../ports/friends/follow.repository.port.js";
import type { FriendshipEffects } from "../../services/friends/friendship-effects.service.js";

export interface AcceptFriendRequestInput {
  readonly userId: string;
  readonly requesterUserId: string;
}

interface AcceptFriendRequestDependencies {
  readonly followRepository: Pick<
    FollowRepositoryPort,
    | "findByFollowerAndFollowing"
    | "getMaxSortOrderForFriends"
    | "update"
    | "create"
    | "findByIdWithUser"
  >;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly effects: Pick<
    FriendshipEffects,
    "invalidateFriendshipCaches" | "notifyMutual" | "checkFirstFriendMilestone"
  >;
  readonly logger: ApplicationLogger;
}

export class AcceptFriendRequest {
  readonly #dependencies: AcceptFriendRequestDependencies;

  constructor(dependencies: AcceptFriendRequestDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: AcceptFriendRequestInput): Promise<FollowWithUser> {
    const { userId, requesterUserId } = input;

    const myFollow = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        MutationLockKeys.friendPair(userId, requesterUserId),
        MutationLockKeys.friendList(userId),
        MutationLockKeys.friendList(requesterUserId),
      ]);
      const request = await this.#dependencies.followRepository.findByFollowerAndFollowing(
        requesterUserId,
        userId,
      );
      if (request === null || !request.isPending()) {
        throw new ApplicationException(ErrorCode.FOLLOW_0903, {
          targetUserId: requesterUserId,
        });
      }

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

      if (existingReverse !== null) {
        existingReverse.accept(maxSortUser + 1);
      }

      const createdFollow =
        existingReverse !== null
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
      if (followWithUser === null) {
        throw new ApplicationException(ErrorCode.SYS_0001, {
          detail: "Failed to retrieve created follow with user info",
          context: { followId: createdFollow.id, userId, requesterUserId },
        });
      }
      return followWithUser;
    });

    this.#dependencies.logger.log({
      event: SocialFriendLogEvent.REQUEST_ACCEPTED,
      userId,
      requesterUserId,
    });

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
