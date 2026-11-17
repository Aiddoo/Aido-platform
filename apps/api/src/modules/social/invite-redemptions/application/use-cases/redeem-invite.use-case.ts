import { INVITE_FRIENDSHIP, REDEEM_OUTCOME } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import {
  FriendshipLockKeys,
  type FriendshipEstablisherPort,
  type FriendshipEstablishment,
  type MutualFriendReaderPort,
} from "#api/modules/social/friendships/social-friendships.public";
import {
  assertInviteEnabled,
  type InviteConfigPort,
  InviteLockKeys,
  inviteNotFound,
  type InviterProfileReadModel,
  type InviteReaderPort,
  inviteRevoked,
  type InviteWithInviterReadModel,
} from "#api/modules/social/invites/social-invites.public";
import type { UserBlockReaderPort } from "#api/modules/social/user-blocks/social-user-blocks.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";

import { InviteCode } from "../../../shared/domain/invite-code.vo.js";
import { InviteId } from "../../../shared/domain/invite-id.vo.js";
import {
  decideInviteRedemption,
  type InviteRedeemDecision,
  rewardClaimSources,
} from "../../domain/invite-abuse.domain-service.js";
import { InviteRedemptionId } from "../../domain/invite-redemption-id.vo.js";
import type { InviteRedemption } from "../../domain/invite-redemption.aggregate.js";
import { RewardClaimId } from "../../domain/reward-claim-id.vo.js";
import { RewardClaim } from "../../domain/reward-claim.entity.js";
import {
  inviteAlreadyRedeemed,
  inviteBlocked,
  inviteeFriendSlotUnavailable,
  inviteUserNotFound,
  selfInvite,
} from "../invite-redemptions.errors.js";
import { InviteRedemptionLogEvent } from "../invite-redemptions.log-events.js";
import type { ClaimHasherPort } from "../ports/claim-hasher.port.js";
import type { InviteNotifierPort } from "../ports/invite-notifier.port.js";
import type { InviteRedemptionRepositoryPort } from "../ports/invite-redemption.repository.port.js";
import type { InviteUserReaderPort } from "../ports/invite-user.reader.port.js";
import type { RewardClaimRepositoryPort } from "../ports/reward-claim.repository.port.js";
import type { RewardGrantRepositoryPort } from "../ports/reward-grant.repository.port.js";
import type { InviteRedeemResultReadModel } from "../read-models/invite-redeem-result.read-model.js";
import type { InviteeIdentityReadModel } from "../read-models/invitee-identity.read-model.js";
import type { RecordInviteRedemptionUseCase } from "./record-invite-redemption.use-case.js";

export interface RedeemInviteCommand {
  readonly inviteeId: string;
  readonly code: string;
  readonly installationId?: string;
  /** 수락 요청의 시간대. 활동일은 이 값으로 고정해 센다. */
  readonly timezone: string;
}

export interface RedeemInviteDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly inviteReader: Pick<InviteReaderPort, "findByCodeWithInviter">;
  readonly inviteRedemptionRepository: Pick<
    InviteRedemptionRepositoryPort,
    "findByInviteeIdForUpdate"
  >;
  readonly rewardClaimRepository: Pick<RewardClaimRepositoryPort, "existsAnyOf">;
  readonly rewardGrantRepository: Pick<RewardGrantRepositoryPort, "listByRedemptionId">;
  readonly recordInviteRedemption: Pick<RecordInviteRedemptionUseCase, "execute">;
  readonly userReader: Pick<InviteUserReaderPort, "findInviteeIdentity">;
  readonly mutualFriendReader: Pick<MutualFriendReaderPort, "isCurrentMutualFriend">;
  readonly blockReader: Pick<UserBlockReaderPort, "findRelation">;
  readonly friendshipEstablisher: Pick<FriendshipEstablisherPort, "establish">;
  readonly claimHasher: Pick<ClaimHasherPort, "hash">;
  readonly notifier: Pick<InviteNotifierPort, "notifyInviteJoined">;
  readonly inviteConfig: Pick<InviteConfigPort, "isEnabled">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn">;
}

interface RedeemContext {
  readonly invite: InviteWithInviterReadModel;
  readonly inviterId: UserId;
  readonly inviter: InviterProfileReadModel;
  readonly inviteeId: UserId;
  readonly claims: readonly RewardClaim[];
  readonly now: Temporal.Instant;
  readonly timeZone: TimeZone;
  readonly previous: InviteRedemption | null;
}

// 초대를 수락해 친구를 맺고, 새로 가입한 사람이면 보상 지급을 남긴다
export class RedeemInviteUseCase {
  readonly #dependencies: RedeemInviteDependencies;

  constructor(dependencies: RedeemInviteDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: RedeemInviteCommand): Promise<InviteRedeemResultReadModel> {
    const { unitOfWork, mutationLock, inviteReader, userReader, clock, logger } =
      this.#dependencies;
    assertInviteEnabled(this.#dependencies.inviteConfig);

    const code = InviteCode.create(command.code);
    const inviteeId = UserId.reconstitute(command.inviteeId);
    const identity = await userReader.findInviteeIdentity(inviteeId);
    if (identity == null) {
      throw inviteUserNotFound(inviteeId);
    }
    const now = clock.now();
    const claims = this.#claimsOf(identity, command.installationId, now);

    const result = await unitOfWork.run(async () => {
      const candidate = await inviteReader.findByCodeWithInviter(code);
      if (candidate == null) {
        throw inviteNotFound();
      }

      // 친구 요청과 같은 키로 동시 수락·친구 한도를, 초대 키로 재발급과의 경합을 직렬화한다
      const candidateInviterId = UserId.reconstitute(candidate.inviterId);
      await mutationLock.acquire([
        InviteLockKeys.invite(candidateInviterId),
        FriendshipLockKeys.pair(candidateInviterId, inviteeId),
        FriendshipLockKeys.list(candidateInviterId),
        FriendshipLockKeys.list(inviteeId),
      ]);
      // 잠금을 기다리는 동안 재발급됐을 수 있어 최신 상태로 다시 읽는다
      const found = await inviteReader.findByCodeWithInviter(code);
      if (found == null) {
        throw inviteNotFound();
      }
      const inviterId = UserId.reconstitute(found.inviterId);
      const { decision, previous } = await this.#decide({
        invite: { inviterId, isActive: found.isActive },
        identity,
        claims,
        now,
      });

      return this.#apply(decision, {
        invite: found,
        inviterId,
        inviter: found.inviter,
        inviteeId,
        claims,
        now,
        // 요청 헤더에서 정규화한 값을 그대로 고정한다. 알 수 없는 값은 활동일 계산이 UTC로 센다
        timeZone: TimeZone.reconstitute(command.timezone),
        previous,
      });
    });

    await this.#notifyJoined(result, identity);
    logger.log({
      event: InviteRedemptionLogEvent.REDEEMED,
      inviteeId: inviteeId.value,
      inviterId: result.inviter.userId,
      outcome: result.outcome,
      rewardCount: result.outcome === REDEEM_OUTCOME.REDEEMED ? result.rewards.length : 0,
    });
    return result;
  }

  #claimsOf(
    identity: InviteeIdentityReadModel,
    installationId: string | undefined,
    now: Temporal.Instant,
  ): RewardClaim[] {
    return rewardClaimSources({
      installationId,
      verifiedEmail: identity.verifiedEmail,
      providerAccounts: identity.providerAccounts,
    }).map((source) =>
      RewardClaim.create({
        id: RewardClaimId.reconstitute(this.#dependencies.claimHasher.hash(source)),
        claimKind: source.claimKind,
        now,
      }),
    );
  }

  async #decide(request: {
    readonly invite: { readonly inviterId: UserId; readonly isActive: boolean };
    readonly identity: InviteeIdentityReadModel;
    readonly claims: readonly RewardClaim[];
    readonly now: Temporal.Instant;
  }): Promise<{
    readonly decision: InviteRedeemDecision;
    readonly previous: InviteRedemption | null;
  }> {
    const { invite, identity, claims, now } = request;
    const inviteeId = UserId.reconstitute(identity.userId);
    // 친구 수가 많아도 두 사람 쌍만 확인한다
    const [areAlreadyFriends, blockRelation, previous, hasClaimedReward] = await Promise.all([
      this.#dependencies.mutualFriendReader.isCurrentMutualFriend(inviteeId, invite.inviterId),
      this.#dependencies.blockReader.findRelation(inviteeId, invite.inviterId),
      this.#dependencies.inviteRedemptionRepository.findByInviteeIdForUpdate(inviteeId),
      this.#dependencies.rewardClaimRepository.existsAnyOf(claims),
    ]);
    const decision = decideInviteRedemption({
      invite,
      inviteeId,
      inviteeJoinedAt: identity.joinedAt,
      areAlreadyFriends,
      isBlockedBetween: blockRelation.isBlocking || blockRelation.isBlockedBy,
      previousRedemption: previous == null ? null : { inviterId: previous.inviterId },
      hasClaimedReward,
      now,
    });
    return { decision, previous };
  }

  async #apply(
    decision: InviteRedeemDecision,
    context: RedeemContext,
  ): Promise<InviteRedeemResultReadModel> {
    const { inviterId, inviter, inviteeId } = context;

    return match(decision)
      .with({ kind: "reject", reason: "SELF_INVITE" }, () => {
        throw selfInvite();
      })
      .with({ kind: "reject", reason: "BLOCKED" }, () => {
        throw inviteBlocked();
      })
      .with({ kind: "reject", reason: "INVITE_REVOKED" }, () => {
        throw inviteRevoked();
      })
      .with({ kind: "reject", reason: "ALREADY_REDEEMED" }, () => {
        throw inviteAlreadyRedeemed();
      })
      .with({ kind: "replay" }, () => this.#replay(context))
      .with({ kind: "already-friends" }, (): InviteRedeemResultReadModel => ({
        outcome: REDEEM_OUTCOME.ALREADY_FRIENDS,
        inviter,
      }))
      .with({ kind: "connect" }, async (): Promise<InviteRedeemResultReadModel> => {
        const established = await this.#establish(inviteeId, inviterId, true);
        if (established === REDEEM_OUTCOME.ALREADY_FRIENDS) {
          return { outcome: REDEEM_OUTCOME.ALREADY_FRIENDS, inviter };
        }
        return { outcome: REDEEM_OUTCOME.CONNECTED, inviter, friendship: established };
      })
      .with({ kind: "redeem" }, ({ rewardEligible }) => this.#redeem(rewardEligible, context))
      .exhaustive();
  }

  async #redeem(
    rewardEligible: boolean,
    context: RedeemContext,
  ): Promise<InviteRedeemResultReadModel> {
    const { invite, inviterId, inviter, inviteeId } = context;
    const recorded = await this.#dependencies.recordInviteRedemption.execute({
      inviteId: InviteId.reconstitute(invite.inviteId),
      inviterId,
      inviteeId,
      claims: context.claims,
      rewardEligible,
      timeZone: context.timeZone,
      now: context.now,
    });
    // 수락·보상은 이미 기록했으므로 그 사이 친구가 됐어도 REDEEMED로 답해 replay와 맞춘다
    const established = await this.#establish(inviteeId, inviterId, false);
    return {
      outcome: REDEEM_OUTCOME.REDEEMED,
      inviter,
      friendship:
        established === REDEEM_OUTCOME.ALREADY_FRIENDS ? INVITE_FRIENDSHIP.FRIENDS : established,
      rewards: recorded.rewards,
      redemptionId: recorded.redemptionId.value,
      isReplay: false,
    };
  }

  // 저장된 초대받은 사람 지급과 지금 친구 관계로 처음 결과를 다시 만든다. 친구 관계는 추정하지 않고
  // 처음 수락과 같은 establish로 다시 맞춘다(이미 친구면 그대로, 그 뒤 끊었으면 다시 맺거나 요청한다)
  async #replay(context: RedeemContext): Promise<InviteRedeemResultReadModel> {
    const { previous, inviteeId } = context;
    if (previous == null) {
      throw inviteAlreadyRedeemed();
    }
    const grants = await this.#dependencies.rewardGrantRepository.listByRedemptionId(previous.id);
    const established = await this.#establish(inviteeId, context.inviterId, false);
    return {
      outcome: REDEEM_OUTCOME.REDEEMED,
      inviter: context.inviter,
      friendship:
        established === REDEEM_OUTCOME.ALREADY_FRIENDS ? INVITE_FRIENDSHIP.FRIENDS : established,
      rewards: grants
        .filter((grant) => grant.isFor(inviteeId))
        .map((grant) => ({ rewardType: grant.rewardType, quantity: grant.quantity })),
      redemptionId: previous.id.value,
      isReplay: true,
    };
  }

  async #establish(
    inviteeId: UserId,
    inviterId: UserId,
    shouldNotifyFriends: boolean,
  ): Promise<Exclude<FriendshipEstablishment, "UNAVAILABLE">> {
    const established = await this.#dependencies.friendshipEstablisher.establish({
      requesterId: inviteeId,
      targetUserId: inviterId,
      shouldNotifyFriends,
    });
    if (established === "UNAVAILABLE") {
      throw inviteeFriendSlotUnavailable();
    }
    return established;
  }

  async #notifyJoined(
    result: InviteRedeemResultReadModel,
    identity: InviteeIdentityReadModel,
  ): Promise<void> {
    if (
      result.outcome !== REDEEM_OUTCOME.REDEEMED ||
      result.isReplay ||
      result.friendship !== INVITE_FRIENDSHIP.FRIENDS
    ) {
      return;
    }
    try {
      await this.#dependencies.notifier.notifyInviteJoined({
        inviterId: UserId.reconstitute(result.inviter.userId),
        inviteeName: identity.displayName,
        redemptionId: InviteRedemptionId.reconstitute(result.redemptionId),
      });
    } catch (error) {
      // 친구 맺기와 보상 기록은 이미 커밋됐으므로 알림 실패로 요청을 실패시키지 않는다
      this.#dependencies.logger.warn({
        event: InviteRedemptionLogEvent.JOINED_NOTIFICATION_FAILED,
        redemptionId: result.redemptionId,
        errorType: toErrorType(error),
      });
    }
  }
}
