import type { RewardAmount } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { type InviteFriendship, REWARD_TYPE } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import type { PremiumGranterPort } from "#api/modules/billing/billing-subscriptions.public";
import type {
  FollowReaderPort,
  FriendshipEstablisherPort,
  FriendshipEstablishment,
} from "#api/modules/social/social-friends.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { InviteRedemption } from "../../../domain/aggregates/invites/invite-redemption.aggregate.js";
import type { Invite } from "../../../domain/aggregates/invites/invite.aggregate.js";
import {
  InviteAbusePolicy,
  type InviteRedeemDecision,
  rewardClaimSources,
} from "../../../domain/policies/invites/invite-abuse.policy.js";
import { InviteRewardPolicy } from "../../../domain/policies/invites/invite-reward.policy.js";
import { rewardGrantSourceKey } from "../../../domain/types/invites/reward-grant.types.js";
import { InviteCode } from "../../../domain/value-objects/invites/invite-code.vo.js";
import { SocialInviteLogEvent } from "../../observability/invites/social-invite-log.events.js";
import type { ClaimHasherPort } from "../../ports/invites/claim-hasher.port.js";
import type { InviteNotifierPort } from "../../ports/invites/invite-notifier.port.js";
import type {
  InviteeIdentity,
  InviteRedemptionRepositoryPort,
} from "../../ports/invites/invite-redemption.repository.port.js";
import type { InviteConfigPort } from "../../ports/invites/invite.config.port.js";
import type {
  InviteRepositoryPort,
  InviterProfile,
} from "../../ports/invites/invite.repository.port.js";
import type {
  RewardClaim,
  RewardClaimRepositoryPort,
} from "../../ports/invites/reward-claim.repository.port.js";
import type { RewardGrantRepositoryPort } from "../../ports/invites/reward-grant.repository.port.js";
import { assertInviteEnabled } from "../../services/invites/invite-availability.guard.js";

export interface RedeemInviteInput {
  readonly inviteeId: string;
  readonly code: string;
  readonly installationId?: string;
  /** 수락 요청의 시간대. 활동일은 이 값으로 고정해 센다. */
  readonly timezone: string;
}

export type RedeemInviteResult =
  | {
      readonly outcome: "REDEEMED";
      readonly inviter: InviterProfile;
      readonly friendship: InviteFriendship;
      readonly rewards: readonly RewardAmount[];
      readonly redemptionId: string;
      /** 응답을 놓친 같은 요청을 다시 받아 저장된 결과를 돌려줬는지 */
      readonly isReplay: boolean;
    }
  | {
      readonly outcome: "CONNECTED";
      readonly inviter: InviterProfile;
      readonly friendship: InviteFriendship;
    }
  | { readonly outcome: "ALREADY_FRIENDS"; readonly inviter: InviterProfile };

interface RedeemInviteDependencies {
  readonly inviteRepository: Pick<InviteRepositoryPort, "findByCodeWithInviter">;
  readonly inviteRedemptionRepository: Pick<
    InviteRedemptionRepositoryPort,
    "findInviteeIdentity" | "findByInviteeIdForUpdate" | "create"
  >;
  readonly rewardClaimRepository: Pick<RewardClaimRepositoryPort, "existsAny" | "claimAll">;
  readonly rewardGrantRepository: Pick<
    RewardGrantRepositoryPort,
    "createPending" | "findBySource" | "markApplied"
  >;
  readonly premiumGranter: PremiumGranterPort;
  readonly followReader: Pick<FollowReaderPort, "isCurrentMutualFriend">;
  readonly friendshipEstablisher: FriendshipEstablisherPort;
  readonly claimHasher: ClaimHasherPort;
  readonly notifier: Pick<InviteNotifierPort, "notifyInviteJoined">;
  readonly inviteConfig: InviteConfigPort;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLogger;
}

/** 초대를 수락해 친구를 맺고, 새로 가입한 사람이면 보상 지급을 남긴다. */
export class RedeemInvite {
  readonly #dependencies: RedeemInviteDependencies;

  constructor(dependencies: RedeemInviteDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RedeemInviteInput): Promise<RedeemInviteResult> {
    assertInviteEnabled(this.#dependencies.inviteConfig);

    const code = InviteCode.of(input.code);
    const identity = await this.#dependencies.inviteRedemptionRepository.findInviteeIdentity(
      input.inviteeId,
    );
    if (identity == null) {
      throw new ApplicationException(ErrorCode.USER_0601, { userId: input.inviteeId });
    }
    const claims = this.#claimsOf(identity, input.installationId);
    const capturedAt = now();

    const result = await this.#dependencies.unitOfWork.run(async () => {
      const candidate = await this.#dependencies.inviteRepository.findByCodeWithInviter(code);
      if (candidate == null) {
        throw new ApplicationException(ErrorCode.INVITE_2101);
      }

      // 친구 요청과 같은 키로 동시 수락·친구 한도를, 초대 키로 재발급과의 경합을 직렬화한다
      await this.#dependencies.mutationLock.acquire([
        MutationLockKeys.invite(candidate.invite.inviterId),
        MutationLockKeys.friendPair(candidate.invite.inviterId, input.inviteeId),
        MutationLockKeys.friendList(candidate.invite.inviterId),
        MutationLockKeys.friendList(input.inviteeId),
      ]);
      // 잠금을 기다리는 동안 재발급됐을 수 있어 최신 상태로 다시 읽는다
      const found = await this.#dependencies.inviteRepository.findByCodeWithInviter(code);
      if (found == null) {
        throw new ApplicationException(ErrorCode.INVITE_2101);
      }
      const { invite, inviter } = found;
      const { decision, previous } = await this.#decide(invite, identity, claims, capturedAt);

      return this.#apply(decision, {
        invite,
        inviter,
        identity,
        claims,
        capturedAt,
        timezone: input.timezone,
        previous,
      });
    });

    await this.#notifyJoined(result, identity);
    this.#dependencies.logger.log({
      event: SocialInviteLogEvent.REDEEMED,
      inviteeId: input.inviteeId,
      inviterId: result.inviter.userId,
      outcome: result.outcome,
      rewardCount: result.outcome === "REDEEMED" ? result.rewards.length : 0,
    });
    return result;
  }

  #claimsOf(identity: InviteeIdentity, installationId: string | undefined): RewardClaim[] {
    return rewardClaimSources({
      installationId,
      verifiedEmail: identity.verifiedEmail,
      providerAccounts: identity.providerAccounts,
    }).map((source) => ({
      claimHash: this.#dependencies.claimHasher.hash(source),
      claimKind: source.claimKind,
    }));
  }

  async #decide(
    invite: Invite,
    identity: InviteeIdentity,
    claims: readonly RewardClaim[],
    capturedAt: Date,
  ): Promise<{
    readonly decision: InviteRedeemDecision;
    readonly previous: InviteRedemption | null;
  }> {
    // 친구 수가 많아도 두 사람 쌍만 확인한다
    const [areAlreadyFriends, previous, hasClaimedReward] = await Promise.all([
      this.#dependencies.followReader.isCurrentMutualFriend(identity.userId, invite.inviterId),
      this.#dependencies.inviteRedemptionRepository.findByInviteeIdForUpdate(identity.userId),
      this.#dependencies.rewardClaimRepository.existsAny(claims.map((claim) => claim.claimHash)),
    ]);
    const decision = InviteAbusePolicy.decide(invite, {
      inviteeId: identity.userId,
      inviteeJoinedAt: identity.createdAt,
      areAlreadyFriends,
      previousRedemption: previous == null ? null : { inviterId: previous.inviterId },
      hasClaimedReward,
      now: capturedAt,
    });
    return { decision, previous };
  }

  async #apply(
    decision: InviteRedeemDecision,
    context: {
      readonly invite: Invite;
      readonly inviter: InviterProfile;
      readonly identity: InviteeIdentity;
      readonly claims: readonly RewardClaim[];
      readonly capturedAt: Date;
      readonly timezone: string;
      readonly previous: InviteRedemption | null;
    },
  ): Promise<RedeemInviteResult> {
    const { invite, inviter, identity } = context;

    return match(decision)
      .with({ kind: "reject", reason: "SELF_INVITE" }, () => {
        throw new ApplicationException(ErrorCode.INVITE_2103);
      })
      .with({ kind: "reject", reason: "INVITE_REVOKED" }, () => {
        throw new ApplicationException(ErrorCode.INVITE_2102);
      })
      .with({ kind: "reject", reason: "ALREADY_REDEEMED" }, () => {
        throw new ApplicationException(ErrorCode.INVITE_2104);
      })
      .with({ kind: "replay" }, () => this.#replay(context))
      .with({ kind: "already-friends" }, (): RedeemInviteResult => ({
        outcome: "ALREADY_FRIENDS",
        inviter,
      }))
      .with({ kind: "connect" }, async (): Promise<RedeemInviteResult> => {
        const established = await this.#establish(identity.userId, invite.inviterId, true);
        if (established === "ALREADY_FRIENDS") {
          return { outcome: "ALREADY_FRIENDS", inviter };
        }
        return { outcome: "CONNECTED", inviter, friendship: established };
      })
      .with({ kind: "redeem" }, async ({ rewardEligible }): Promise<RedeemInviteResult> => {
        // 동시에 같은 기기로 수락하면 기기 해시 INSERT에서 한 번만 이긴다. 수락 행이 충돌하면
        // 트랜잭션과 함께 claim도 되돌아간다
        const isRewardClaimed =
          rewardEligible &&
          (await this.#dependencies.rewardClaimRepository.claimAll(
            context.claims,
            context.capturedAt,
          ));
        const redemption = await this.#dependencies.inviteRedemptionRepository.create(
          InviteRedemption.planCreation({
            inviteId: invite.id,
            inviterId: invite.inviterId,
            inviteeId: identity.userId,
            timezone: context.timezone,
            // 같은 기기·신원으로 이미 받은 수락은 부계정으로 초대한 사람 보상을 쌓지 못하게 함께 막는다
            inviterRewardEligible: isRewardClaimed,
            joinedAt: context.capturedAt,
          }),
        );
        if (redemption == null) {
          throw new ApplicationException(ErrorCode.INVITE_2104);
        }
        const { rewards, plans } = InviteRewardPolicy.planInviteeRewards(
          redemption,
          isRewardClaimed,
        );
        await this.#dependencies.rewardGrantRepository.createPending(plans);
        await this.#applyInviteePremiumNow(redemption.id, identity.userId, context.capturedAt);

        // 수락·보상은 이미 기록했으므로 그 사이 친구가 됐어도 REDEEMED로 답해 replay와 맞춘다
        const established = await this.#establish(identity.userId, invite.inviterId, false);
        return {
          outcome: "REDEEMED",
          inviter,
          friendship: established === "ALREADY_FRIENDS" ? "FRIENDS" : established,
          rewards,
          redemptionId: redemption.id,
          isReplay: false,
        };
      })
      .exhaustive();
  }

  /**
   * 수락 화면이 "프리미엄 7일을 받았어요"를 바로 보여 주므로 초대받은 사람의 프리미엄 일수는 같은
   * 트랜잭션에서 보상 기간으로 바꾸고 원장을 APPLIED로 남긴다. 친구 한도 잠금 뒤에 사용자 행을 잠가
   * 웹훅·sweep·지급 작업(사용자 잠금만 잡는다)과 순서가 엇갈리지 않는다. 같은 출처 키라 지급 작업이
   * 다시 골라도 한 번만 반영된다.
   */
  async #applyInviteePremiumNow(
    redemptionId: string,
    inviteeId: string,
    appliedAt: Date,
  ): Promise<void> {
    const grants = await this.#dependencies.rewardGrantRepository.findBySource(
      "INVITE_REDEMPTION",
      redemptionId,
    );
    for (const grant of grants) {
      if (grant.recipientId !== inviteeId || grant.rewardType !== REWARD_TYPE.PREMIUM_DAYS) {
        continue;
      }
      if (!(await this.#dependencies.rewardGrantRepository.markApplied(grant.id, appliedAt))) {
        continue;
      }
      const result = await this.#dependencies.premiumGranter.grant({
        userId: inviteeId,
        source: "INVITE",
        sourceKey: rewardGrantSourceKey(grant.id),
        durationDays: grant.quantity,
      });
      if (result.status === "user-missing") {
        throw new ApplicationException(ErrorCode.USER_0601, { userId: inviteeId });
      }
    }
  }

  /**
   * 저장된 초대받은 사람 지급과 지금 친구 관계로 처음 결과를 다시 만든다. 친구 관계는 추정하지 않고
   * 처음 수락과 같은 establish로 다시 맞춘다(이미 친구면 그대로, 그 뒤 끊었으면 다시 맺거나 요청한다).
   */
  async #replay(context: {
    readonly invite: Invite;
    readonly inviter: InviterProfile;
    readonly identity: InviteeIdentity;
    readonly previous: InviteRedemption | null;
  }): Promise<RedeemInviteResult> {
    if (context.previous == null) {
      throw new ApplicationException(ErrorCode.INVITE_2104);
    }
    const grants = await this.#dependencies.rewardGrantRepository.findBySource(
      "INVITE_REDEMPTION",
      context.previous.id,
    );
    const established = await this.#establish(
      context.identity.userId,
      context.invite.inviterId,
      false,
    );
    return {
      outcome: "REDEEMED",
      inviter: context.inviter,
      friendship: established === "ALREADY_FRIENDS" ? "FRIENDS" : established,
      rewards: grants
        .filter((grant) => grant.recipientId === context.identity.userId)
        .map((grant) => ({ rewardType: grant.rewardType, quantity: grant.quantity })),
      redemptionId: context.previous.id,
      isReplay: true,
    };
  }

  async #establish(
    inviteeId: string,
    inviterId: string,
    shouldNotifyFriends: boolean,
  ): Promise<Exclude<FriendshipEstablishment, "UNAVAILABLE">> {
    const established = await this.#dependencies.friendshipEstablisher.establish({
      requesterId: inviteeId,
      targetUserId: inviterId,
      shouldNotifyFriends,
    });
    if (established === "UNAVAILABLE") {
      throw new ApplicationException(ErrorCode.INVITE_2106);
    }
    return established;
  }

  async #notifyJoined(result: RedeemInviteResult, identity: InviteeIdentity): Promise<void> {
    if (result.outcome !== "REDEEMED" || result.isReplay || result.friendship !== "FRIENDS") {
      return;
    }
    try {
      await this.#dependencies.notifier.notifyInviteJoined({
        inviterId: result.inviter.userId,
        inviteeName: identity.displayName,
        redemptionId: result.redemptionId,
      });
    } catch (error) {
      // 친구 맺기와 보상 기록은 이미 커밋됐으므로 알림 실패로 요청을 실패시키지 않는다
      this.#dependencies.logger.warn({
        event: SocialInviteLogEvent.JOINED_NOTIFICATION_FAILED,
        redemptionId: result.redemptionId,
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }
}
