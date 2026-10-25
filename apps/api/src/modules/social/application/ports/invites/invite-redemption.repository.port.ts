import type { RedemptionStatus } from "@aido/api/vocabulary";

import type {
  InviteRedemption,
  InviteRedemptionCreationPlan,
} from "../../../domain/aggregates/invites/invite-redemption.aggregate.js";

/** 같은 신원 중복 보상을 판단하는 초대받은 사람 정보. 원문은 해시로만 쓰고 저장하지 않는다. */
export interface InviteeIdentity {
  readonly userId: string;
  readonly createdAt: Date;
  /** 인증을 마친 이메일. 인증 전이면 null */
  readonly verifiedEmail: string | null;
  readonly providerAccounts: readonly {
    readonly provider: string;
    readonly providerAccountId: string;
  }[];
}

export interface InviteRedemptionSummary {
  readonly joinedCount: number;
  readonly qualifiedCount: number;
  readonly rewardedCount: number;
  readonly rejectedCount: number;
}

/** 초대한 친구 목록 한 줄 (User·UserProfile·활동일 수를 include로 한 문장에 읽는다) */
export interface InvitedFriendRecord {
  readonly userId: string;
  readonly name: string | null;
  readonly userTag: string;
  readonly profileImage: string | null;
  readonly status: RedemptionStatus;
  readonly activeDayCount: number;
  readonly joinedAt: Date;
  readonly qualifiedAt: Date | null;
}

export interface FindInvitedFriendsParams {
  readonly inviterId: string;
  /** 마지막으로 받은 초대받은 사람 userId */
  readonly cursor?: string;
  /** 없으면 모든 상태 */
  readonly status?: RedemptionStatus;
  readonly size: number;
}

export const INVITE_REDEMPTION_REPOSITORY = Symbol("INVITE_REDEMPTION_REPOSITORY");

export interface InviteRedemptionRepositoryPort {
  findInviteeIdentity(inviteeId: string): Promise<InviteeIdentity | null>;
  existsByInviteeId(inviteeId: string): Promise<boolean>;
  /** inviteeId UNIQUE와 충돌하면 저장하지 않고 null을 반환한다. */
  create(plan: InviteRedemptionCreationPlan): Promise<InviteRedemption | null>;
  /** 할 일 토글마다 불리므로 inviteeId UNIQUE 인덱스만 확인한다. */
  hasJoinedByInviteeId(inviteeId: string): Promise<boolean>;
  findByInviteeIdForUpdate(inviteeId: string): Promise<InviteRedemption | null>;
  findByIdForUpdate(redemptionId: string): Promise<InviteRedemption | null>;
  save(redemption: InviteRedemption): Promise<void>;
  summarizeByInviterId(inviterId: string): Promise<InviteRedemptionSummary>;
  findInvitedFriends(params: FindInvitedFriendsParams): Promise<InvitedFriendRecord[]>;
  /** 마감이 지난 JOINED를 한 묶음씩 SKIP LOCKED로 거절하고 처리 수를 반환한다. */
  expireJoinedBefore(at: Date, limit: number): Promise<number>;
}
