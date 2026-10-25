import {
  INVITE_QUALIFICATION,
  REDEMPTION_REJECTION_REASON,
  type RedemptionRejectionReason,
} from "@aido/api/vocabulary";

import { addDays } from "#api/shared/domain/date/utils/arithmetic";
import { AggregateRoot } from "#api/shared/domain/index";

import {
  RedemptionStatus,
  type RedemptionStatusValue,
} from "../../value-objects/invites/redemption-status.vo.js";

export interface InviteRedemptionProps {
  id: string;
  inviteId: string | null;
  inviterId: string | null;
  inviteeId: string;
  status: RedemptionStatusValue;
  rejectionReason: RedemptionRejectionReason | null;
  /** 수락할 때 고정한 초대받은 사람 시간대. 활동일은 이 시간대로만 센다. */
  timezone: string;
  /** 같은 기기·신원 재사용으로 초대받은 사람 보상을 막았으면 초대한 사람 보상도 주지 않는다. */
  inviterRewardEligible: boolean;
  /** 초대받은 사람 시간대의 YYYY-MM-DD 달력 날짜 */
  activeDays: readonly string[];
  joinedAt: Date;
  qualifiedAt: Date | null;
  rewardedAt: Date | null;
  rejectedAt: Date | null;
  expiresAt: Date;
}

export interface InviteRedemptionCreationInput {
  readonly inviteId: string;
  readonly inviterId: string;
  readonly inviteeId: string;
  readonly timezone: string;
  readonly inviterRewardEligible: boolean;
  readonly joinedAt: Date;
}

export interface InviteRedemptionCreationPlan {
  readonly inviteId: string;
  readonly inviterId: string;
  readonly inviteeId: string;
  readonly status: "JOINED";
  readonly timezone: string;
  readonly inviterRewardEligible: boolean;
  readonly joinedAt: Date;
  readonly expiresAt: Date;
}

export type InviteRedemptionPersistenceState = Pick<
  InviteRedemptionProps,
  "status" | "rejectionReason" | "qualifiedAt" | "rewardedAt" | "rejectedAt"
> & {
  /** 이번 변경에서 새로 기록한 날짜만 담는다. */
  readonly addedActiveDays: readonly string[];
};

type InviteRedemptionState = Omit<InviteRedemptionProps, "status" | "activeDays"> & {
  status: RedemptionStatus;
  activeDays: Set<string>;
  addedActiveDays: string[];
};

export class InviteRedemption extends AggregateRoot<InviteRedemptionState> {
  private constructor(props: InviteRedemptionState) {
    super(props);
  }

  static planCreation(input: InviteRedemptionCreationInput): InviteRedemptionCreationPlan {
    return {
      inviteId: input.inviteId,
      inviterId: input.inviterId,
      inviteeId: input.inviteeId,
      status: "JOINED",
      timezone: input.timezone,
      inviterRewardEligible: input.inviterRewardEligible,
      joinedAt: new Date(input.joinedAt),
      expiresAt: addDays(INVITE_QUALIFICATION.EXPIRE_AFTER_DAYS, input.joinedAt),
    };
  }

  static reconstitute(props: InviteRedemptionProps): InviteRedemption {
    return new InviteRedemption({
      id: props.id,
      inviteId: props.inviteId,
      inviterId: props.inviterId,
      inviteeId: props.inviteeId,
      status: RedemptionStatus.of(props.status),
      rejectionReason: props.rejectionReason,
      timezone: props.timezone,
      inviterRewardEligible: props.inviterRewardEligible,
      activeDays: new Set(props.activeDays),
      addedActiveDays: [],
      joinedAt: new Date(props.joinedAt),
      qualifiedAt: props.qualifiedAt === null ? null : new Date(props.qualifiedAt),
      rewardedAt: props.rewardedAt === null ? null : new Date(props.rewardedAt),
      rejectedAt: props.rejectedAt === null ? null : new Date(props.rejectedAt),
      expiresAt: new Date(props.expiresAt),
    });
  }

  get id(): string {
    return this.props.id;
  }

  get inviteId(): string | null {
    return this.props.inviteId;
  }

  get inviterId(): string | null {
    return this.props.inviterId;
  }

  get inviteeId(): string {
    return this.props.inviteeId;
  }

  get status(): RedemptionStatusValue {
    return this.props.status.raw;
  }

  get rejectionReason(): RedemptionRejectionReason | null {
    return this.props.rejectionReason;
  }

  get timezone(): string {
    return this.props.timezone;
  }

  get inviterRewardEligible(): boolean {
    return this.props.inviterRewardEligible;
  }

  get activeDays(): string[] {
    return [...this.props.activeDays].sort();
  }

  get joinedAt(): Date {
    return new Date(this.props.joinedAt);
  }

  get qualifiedAt(): Date | null {
    return this.props.qualifiedAt === null ? null : new Date(this.props.qualifiedAt);
  }

  get rewardedAt(): Date | null {
    return this.props.rewardedAt === null ? null : new Date(this.props.rewardedAt);
  }

  get expiresAt(): Date {
    return new Date(this.props.expiresAt);
  }

  isExpiredAt(at: Date): boolean {
    return at.getTime() >= this.props.expiresAt.getTime();
  }

  /** 사용 시작 전, 만료 전의 새 날짜만 기록한다. 같은 날짜를 다시 기록하면 false다. */
  recordActiveDay(localDate: string, at: Date): boolean {
    if (!this.props.status.is("JOINED") || this.isExpiredAt(at)) {
      return false;
    }
    if (this.props.activeDays.has(localDate)) {
      return false;
    }
    this.props.activeDays.add(localDate);
    this.props.addedActiveDays.push(localDate);
    return true;
  }

  qualify(qualifiedAt: Date): boolean {
    if (!this.#transitionTo("QUALIFIED")) return false;
    this.props.qualifiedAt = new Date(qualifiedAt);
    return true;
  }

  markRewarded(rewardedAt: Date): boolean {
    if (!this.#transitionTo("REWARDED")) return false;
    this.props.rewardedAt = new Date(rewardedAt);
    return true;
  }

  expire(expiredAt: Date): boolean {
    return this.#reject(REDEMPTION_REJECTION_REASON.EXPIRED, expiredAt);
  }

  toPersistence(): InviteRedemptionPersistenceState {
    return {
      status: this.status,
      rejectionReason: this.props.rejectionReason,
      qualifiedAt: this.qualifiedAt,
      rewardedAt: this.rewardedAt,
      rejectedAt: this.props.rejectedAt === null ? null : new Date(this.props.rejectedAt),
      addedActiveDays: [...this.props.addedActiveDays],
    };
  }

  #reject(reason: RedemptionRejectionReason, rejectedAt: Date): boolean {
    if (!this.#transitionTo("REJECTED")) return false;
    this.props.rejectionReason = reason;
    this.props.rejectedAt = new Date(rejectedAt);
    return true;
  }

  #transitionTo(next: RedemptionStatusValue): boolean {
    const status = this.props.status.transitionTo(next);
    if (status === null) return false;
    this.props.status = status;
    return true;
  }
}
