import { INVITE_REDEEM_WINDOW_DAYS } from "@aido/api/vocabulary";
import { uniq } from "es-toolkit";
import { match } from "ts-pattern";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { InviteRejectionCause, RewardClaimKind } from "./invite-redemptions.constants.js";

const HOURS_PER_DAY = 24;

export type InviteRedeemDecision =
  /** 같은 기기·신원으로 이미 보상을 받았으면 초대받은 사람과 초대한 사람 보상을 모두 주지 않는다. */
  | { readonly kind: "redeem"; readonly rewardEligible: boolean }
  | { readonly kind: "replay" }
  | { readonly kind: "connect" }
  | { readonly kind: "already-friends" }
  | { readonly kind: "reject"; readonly reason: InviteRejectionCause };

export interface RewardClaimSource {
  readonly claimKind: RewardClaimKind;
  /** 해시 전 정규화한 값. 저장하거나 기록하지 않는다. */
  readonly value: string;
}

export interface RewardClaimIdentity {
  readonly installationId?: string;
  readonly verifiedEmail: string | null;
  readonly providerAccounts: readonly {
    readonly provider: string;
    readonly providerAccountId: string;
  }[];
}

/** 가입한 지 초대 수락 기간(7일, 24시간 단위)이 지나지 않은 사용자만 새 친구 보상을 받는다. */
export function isWithinRedeemWindow(params: {
  readonly joinedAt: Temporal.Instant;
  readonly now: Temporal.Instant;
}): boolean {
  const windowStart = params.now.subtract({ hours: INVITE_REDEEM_WINDOW_DAYS * HOURS_PER_DAY });
  return Temporal.Instant.compare(params.joinedAt, windowStart) > 0;
}

/** 기기 ID와, 인증한 이메일이 없으면 소셜 로그인 계정을 신원으로 쓴다. */
export function rewardClaimSources(identity: RewardClaimIdentity): RewardClaimSource[] {
  const installationId = identity.installationId?.trim();
  const installation: RewardClaimSource[] =
    installationId == null || installationId.length === 0
      ? []
      : [{ claimKind: "INSTALLATION", value: installationId }];
  const email = identity.verifiedEmail?.trim().toLowerCase();
  const identities =
    email != null && email.length > 0
      ? [email]
      : uniq(
          identity.providerAccounts.map(
            (account) => `${account.provider}:${account.providerAccountId}`,
          ),
        );
  return [
    ...installation,
    ...identities.map((value): RewardClaimSource => ({ claimKind: "IDENTITY", value })),
  ];
}

// 수락 판정에 필요한 초대의 두 사실. 초대는 invites slice가 소유해 Aggregate 대신 값으로 받는다
export interface RedeemableInvite {
  readonly inviterId: UserId;
  readonly isActive: boolean;
}

export function decideInviteRedemption(params: {
  readonly invite: RedeemableInvite;
  readonly inviteeId: UserId;
  readonly inviteeJoinedAt: Temporal.Instant;
  readonly areAlreadyFriends: boolean;
  /** 두 사람 중 한 명이 다른 사람을 차단했는지 */
  readonly isBlockedBetween: boolean;
  /** 이미 수락한 초대. 초대한 사람이 탈퇴했으면 inviterId가 null이다. */
  readonly previousRedemption: { readonly inviterId: UserId | null } | null;
  /** 같은 기기·같은 신원으로 이미 보상을 받았는지 */
  readonly hasClaimedReward: boolean;
  readonly now: Temporal.Instant;
}): InviteRedeemDecision {
  const { invite, previousRedemption } = params;
  const previousInviterId = previousRedemption?.inviterId ?? null;
  return (
    match({
      isSelf: invite.inviterId.equals(params.inviteeId),
      isBlocked: params.isBlockedBetween,
      // 응답을 못 받고 다시 누른 같은 초대는 처음 결과를 다시 돌려준다
      isRetry: previousInviterId != null && previousInviterId.equals(invite.inviterId),
      isRevoked: !invite.isActive,
      areAlreadyFriends: params.areAlreadyFriends,
      hasRedeemedOther: previousRedemption != null,
      isNewInvitee: isWithinRedeemWindow({ joinedAt: params.inviteeJoinedAt, now: params.now }),
    })
      .returnType<InviteRedeemDecision>()
      .with({ isSelf: true }, () => ({ kind: "reject", reason: "SELF_INVITE" }))
      // 차단 관계에서는 다시 누른 수락도 친구를 맺지 않는다
      .with({ isBlocked: true }, () => ({ kind: "reject", reason: "BLOCKED" }))
      .with({ isRetry: true }, () => ({ kind: "replay" }))
      .with({ isRevoked: true }, () => ({ kind: "reject", reason: "INVITE_REVOKED" }))
      .with({ areAlreadyFriends: true }, () => ({ kind: "already-friends" }))
      .with({ hasRedeemedOther: true }, () => ({ kind: "reject", reason: "ALREADY_REDEEMED" }))
      .with({ isNewInvitee: false }, () => ({ kind: "connect" }))
      .with(
        {
          isSelf: false,
          isBlocked: false,
          isRetry: false,
          isRevoked: false,
          areAlreadyFriends: false,
          hasRedeemedOther: false,
          isNewInvitee: true,
        },
        () => ({ kind: "redeem", rewardEligible: !params.hasClaimedReward }),
      )
      .exhaustive()
  );
}
