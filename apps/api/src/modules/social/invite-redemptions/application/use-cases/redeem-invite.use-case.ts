import { INVITE_FRIENDSHIP, REDEEM_OUTCOME, REWARD_TYPE } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import type { UserBlockReaderPort } from "#api/modules/social/blocks/social-block-queries.public";
import {
  FriendLockKeys,
  type FriendshipEstablisherPort,
  type FriendshipEstablishment,
  type MutualFriendReaderPort,
} from "#api/modules/social/friends/social-friends.public";
import {
  assertInviteEnabled,
  type InviteConfigPort,
  InviteLockKeys,
  inviteNotFound,
  type InviterProfile,
  type InviteReaderPort,
  inviteRevoked,
  type InviteWithInviterReadModel,
} from "#api/modules/social/invites/social-invites.public";
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
import { InviteRedemption } from "../../domain/invite-redemption.aggregate.js";
import {
  planInviteeRewards,
  type RewardGrantPlan,
} from "../../domain/invite-reward.domain-service.js";
import { RewardClaimId } from "../../domain/reward-claim-id.vo.js";
import { RewardClaim } from "../../domain/reward-claim.entity.js";
import { RewardGrantId } from "../../domain/reward-grant-id.vo.js";
import { RewardGrant } from "../../domain/reward-grant.entity.js";
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
import type { InviteRewardSchedulerPort } from "../ports/invite-reward-scheduler.port.js";
import type { InviteUserReaderPort } from "../ports/invite-user.reader.port.js";
import type { RewardApplierPort } from "../ports/reward-applier.port.js";
import type { RewardClaimRepositoryPort } from "../ports/reward-claim.repository.port.js";
import type { RewardGrantRepositoryPort } from "../ports/reward-grant.repository.port.js";
import type { InviteRedeemResult } from "../read-models/invite-redeem-result.read-model.js";
import type { InviteeIdentity } from "../read-models/invitee-identity.read-model.js";

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
    "save" | "findByInviteeIdForUpdate"
  >;
  readonly rewardClaimRepository: Pick<RewardClaimRepositoryPort, "existsAnyOf" | "claimAll">;
  readonly rewardGrantRepository: Pick<
    RewardGrantRepositoryPort,
    "addPending" | "listByRedemptionId" | "markApplied"
  >;
  readonly userReader: Pick<InviteUserReaderPort, "findInviteeIdentity">;
  readonly rewardApplier: Pick<RewardApplierPort, "apply">;
  readonly mutualFriendReader: Pick<MutualFriendReaderPort, "isCurrentMutualFriend">;
  readonly blockReader: Pick<UserBlockReaderPort, "findRelation">;
  readonly friendshipEstablisher: Pick<FriendshipEstablisherPort, "establish">;
  readonly claimHasher: Pick<ClaimHasherPort, "hash">;
  readonly notifier: Pick<InviteNotifierPort, "notifyInviteJoined">;
  readonly rewardScheduler: Pick<InviteRewardSchedulerPort, "schedule">;
  readonly inviteConfig: Pick<InviteConfigPort, "isEnabled">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn">;
}

interface RedeemContext {
  readonly invite: InviteWithInviterReadModel;
  readonly inviterId: UserId;
  readonly inviter: InviterProfile;
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

  async execute(command: RedeemInviteCommand): Promise<InviteRedeemResult> {
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
        FriendLockKeys.pair(candidateInviterId, inviteeId),
        FriendLockKeys.list(candidateInviterId),
        FriendLockKeys.list(inviteeId),
      ]);
      // 잠금을 기다리는 동안 재발급됐을 수 있어 최신 상태로 다시 읽는다
      const found = await inviteReader.findByCodeWithInviter(code);
      if (found == null) {
        throw inviteNotFound();
      }
      const inviterId = UserId.reconstitute(found.inviterId);
      const { decision, previous } = await this.#decide(
        { inviterId, isActive: found.isActive },
        identity,
        claims,
        now,
      );

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
    identity: InviteeIdentity,
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

  async #decide(
    invite: { readonly inviterId: UserId; readonly isActive: boolean },
    identity: InviteeIdentity,
    claims: readonly RewardClaim[],
    now: Temporal.Instant,
  ): Promise<{
    readonly decision: InviteRedeemDecision;
    readonly previous: InviteRedemption | null;
  }> {
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
  ): Promise<InviteRedeemResult> {
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
      .with({ kind: "already-friends" }, (): InviteRedeemResult => ({
        outcome: REDEEM_OUTCOME.ALREADY_FRIENDS,
        inviter,
      }))
      .with({ kind: "connect" }, async (): Promise<InviteRedeemResult> => {
        const established = await this.#establish(inviteeId, inviterId, true);
        if (established === REDEEM_OUTCOME.ALREADY_FRIENDS) {
          return { outcome: REDEEM_OUTCOME.ALREADY_FRIENDS, inviter };
        }
        return { outcome: REDEEM_OUTCOME.CONNECTED, inviter, friendship: established };
      })
      .with({ kind: "redeem" }, ({ rewardEligible }) => this.#redeem(rewardEligible, context))
      .exhaustive();
  }

  async #redeem(rewardEligible: boolean, context: RedeemContext): Promise<InviteRedeemResult> {
    const { inviteRedemptionRepository, rewardClaimRepository, rewardScheduler } =
      this.#dependencies;
    const { invite, inviterId, inviter, inviteeId, now } = context;
    // 동시에 같은 기기로 수락하면 기기 해시 INSERT에서 한 번만 이긴다. 수락 행이 충돌하면
    // 저장이 INVITE_2104로 실패해 트랜잭션과 함께 claim도 되돌아간다
    const isRewardClaimed =
      rewardEligible && (await rewardClaimRepository.claimAll(context.claims));
    const redemption = InviteRedemption.create({
      id: InviteRedemptionId.generate(),
      inviteId: InviteId.reconstitute(invite.inviteId),
      inviterId,
      inviteeId,
      timeZone: context.timeZone,
      // 같은 기기·신원으로 이미 받은 수락은 부계정으로 초대한 사람 보상을 쌓지 못하게 함께 막는다
      inviterRewardEligible: isRewardClaimed,
      now,
    });
    await inviteRedemptionRepository.save(redemption);
    const { rewards, plans } = planInviteeRewards({
      redemptionId: redemption.id,
      inviteeId,
      isRewardClaimed,
    });
    if (plans.length > 0) {
      await this.#addPendingGrants(plans, now);
      const pendingCount = await this.#applyInviteePremiumNow(redemption.id, inviteeId, now);
      // 바로 적용하지 않은 지급이 남으면 원장과 같은 트랜잭션에 작업을 넣어 커밋되면 반드시 처리된다
      if (pendingCount > 0) {
        await rewardScheduler.schedule(redemption.id, { kind: "redeemed" });
      }
    }

    // 수락·보상은 이미 기록했으므로 그 사이 친구가 됐어도 REDEEMED로 답해 replay와 맞춘다
    const established = await this.#establish(inviteeId, inviterId, false);
    return {
      outcome: REDEEM_OUTCOME.REDEEMED,
      inviter,
      friendship:
        established === REDEEM_OUTCOME.ALREADY_FRIENDS ? INVITE_FRIENDSHIP.FRIENDS : established,
      rewards,
      redemptionId: redemption.id.value,
      isReplay: false,
    };
  }

  async #addPendingGrants(plans: readonly RewardGrantPlan[], now: Temporal.Instant): Promise<void> {
    const { rewardGrantRepository } = this.#dependencies;
    await rewardGrantRepository.addPending(
      plans.map((plan) => RewardGrant.create({ id: RewardGrantId.generate(), plan, now })),
    );
  }

  /**
   * 수락 화면이 "프리미엄 7일을 받았어요"를 바로 보여 주므로 초대받은 사람의 프리미엄 일수는 같은
   * 트랜잭션에서 보상 기간으로 바꾸고 원장을 APPLIED로 남긴다. 친구 한도 잠금 뒤에 사용자 행을 잠가
   * 웹훅·sweep·지급 작업(사용자 잠금만 잡는다)과 순서가 엇갈리지 않는다. 같은 출처 키라 지급 작업이
   * 다시 골라도 한 번만 반영된다. 바로 적용하지 않고 남긴 지급 수를 반환한다.
   */
  async #applyInviteePremiumNow(
    redemptionId: InviteRedemptionId,
    inviteeId: UserId,
    now: Temporal.Instant,
  ): Promise<number> {
    const { rewardGrantRepository, rewardApplier } = this.#dependencies;
    const grants = await rewardGrantRepository.listByRedemptionId(redemptionId);
    let pendingCount = 0;
    for (const grant of grants) {
      if (!grant.isFor(inviteeId) || grant.rewardType !== REWARD_TYPE.PREMIUM_DAYS) {
        if (!grant.isApplied()) {
          pendingCount += 1;
        }
        continue;
      }
      if (!(await rewardGrantRepository.markApplied(grant.id, now))) {
        continue;
      }
      await rewardApplier.apply(grant);
    }
    return pendingCount;
  }

  /**
   * 저장된 초대받은 사람 지급과 지금 친구 관계로 처음 결과를 다시 만든다. 친구 관계는 추정하지 않고
   * 처음 수락과 같은 establish로 다시 맞춘다(이미 친구면 그대로, 그 뒤 끊었으면 다시 맺거나 요청한다).
   */
  async #replay(context: RedeemContext): Promise<InviteRedeemResult> {
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

  async #notifyJoined(result: InviteRedeemResult, identity: InviteeIdentity): Promise<void> {
    if (
      result.outcome !== REDEEM_OUTCOME.REDEEMED ||
      result.isReplay ||
      result.friendship !== INVITE_FRIENDSHIP.FRIENDS
    ) {
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
        event: InviteRedemptionLogEvent.JOINED_NOTIFICATION_FAILED,
        redemptionId: result.redemptionId,
        errorType: toErrorType(error),
      });
    }
  }
}
