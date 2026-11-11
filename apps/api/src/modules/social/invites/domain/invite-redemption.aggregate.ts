import {
  REDEMPTION_REJECTION_REASON,
  REDEMPTION_STATUS,
  type RedemptionRejectionReason,
} from "@aido/api/vocabulary";
import type { RedemptionStatus as RedemptionStatusValue } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";

import { InviteId } from "./invite-id.vo.js";
import {
  hasEnoughActiveDays,
  localActivityDate,
  qualificationExpiresAt,
} from "./invite-qualification.domain-service.js";
import {
  hasOneActiveDayLeft,
  qualifyReminderExpiresBefore,
} from "./invite-qualify-reminder.domain-service.js";
import { InviteRedemptionId } from "./invite-redemption-id.vo.js";
import { RedemptionStatus } from "./redemption-status.vo.js";

export interface InviteRedemptionPrimitives {
  readonly id: string;
  /** 초대가 지워지면 null이다. */
  readonly inviteId: string | null;
  /** 초대한 사람이 탈퇴하면 null이다. */
  readonly inviterId: string | null;
  readonly inviteeId: string;
  readonly status: RedemptionStatusValue;
  readonly rejectionReason: RedemptionRejectionReason | null;
  /** 수락할 때 고정한 초대받은 사람 시간대. 활동일은 이 시간대로만 센다. */
  readonly timezone: string;
  /** 같은 기기·신원 재사용으로 초대받은 사람 보상을 막았으면 초대한 사람 보상도 주지 않는다. */
  readonly inviterRewardEligible: boolean;
  /** 초대받은 사람 시간대의 달력 날짜, 오름차순 */
  readonly activeDays: readonly Temporal.PlainDate[];
  readonly joinedAt: Temporal.Instant;
  readonly qualifiedAt: Temporal.Instant | null;
  readonly rewardedAt: Temporal.Instant | null;
  readonly rejectedAt: Temporal.Instant | null;
  readonly expiresAt: Temporal.Instant;
  /** 사용 시작을 권하는 알림을 보낸 시각. 수락 한 건에 한 번만 보낸다. */
  readonly qualifyReminderSentAt: Temporal.Instant | null;
}

interface InviteRedemptionProps {
  readonly inviteId: InviteId | null;
  readonly inviterId: UserId | null;
  readonly inviteeId: UserId;
  status: RedemptionStatus;
  rejectionReason: RedemptionRejectionReason | null;
  readonly timeZone: TimeZone;
  readonly inviterRewardEligible: boolean;
  activeDays: Temporal.PlainDate[];
  readonly joinedAt: Temporal.Instant;
  qualifiedAt: Temporal.Instant | null;
  rewardedAt: Temporal.Instant | null;
  rejectedAt: Temporal.Instant | null;
  readonly expiresAt: Temporal.Instant;
  qualifyReminderSentAt: Temporal.Instant | null;
}

interface CreateInviteRedemptionParams {
  readonly id: InviteRedemptionId;
  readonly inviteId: InviteId;
  readonly inviterId: UserId;
  readonly inviteeId: UserId;
  readonly timeZone: TimeZone;
  readonly inviterRewardEligible: boolean;
  readonly now: Temporal.Instant;
}

function sortedDays(days: readonly Temporal.PlainDate[]): Temporal.PlainDate[] {
  return days.toSorted(Temporal.PlainDate.compare);
}

export class InviteRedemption extends AggregateRoot<InviteRedemptionId, InviteRedemptionProps> {
  static create(params: CreateInviteRedemptionParams): InviteRedemption {
    return new InviteRedemption(params.id, {
      inviteId: params.inviteId,
      inviterId: params.inviterId,
      inviteeId: params.inviteeId,
      status: RedemptionStatus.JOINED,
      rejectionReason: null,
      timeZone: params.timeZone,
      inviterRewardEligible: params.inviterRewardEligible,
      activeDays: [],
      joinedAt: params.now,
      qualifiedAt: null,
      rewardedAt: null,
      rejectedAt: null,
      expiresAt: qualificationExpiresAt(params.now),
      qualifyReminderSentAt: null,
    });
  }

  static reconstitute(primitives: InviteRedemptionPrimitives): InviteRedemption {
    return new InviteRedemption(InviteRedemptionId.reconstitute(primitives.id), {
      inviteId: primitives.inviteId == null ? null : InviteId.reconstitute(primitives.inviteId),
      inviterId: primitives.inviterId == null ? null : UserId.reconstitute(primitives.inviterId),
      inviteeId: UserId.reconstitute(primitives.inviteeId),
      status: RedemptionStatus.reconstitute(primitives.status),
      rejectionReason: primitives.rejectionReason,
      timeZone: TimeZone.reconstitute(primitives.timezone),
      inviterRewardEligible: primitives.inviterRewardEligible,
      activeDays: sortedDays(primitives.activeDays),
      joinedAt: primitives.joinedAt,
      qualifiedAt: primitives.qualifiedAt,
      rewardedAt: primitives.rewardedAt,
      rejectedAt: primitives.rejectedAt,
      expiresAt: primitives.expiresAt,
      qualifyReminderSentAt: primitives.qualifyReminderSentAt,
    });
  }

  get inviteId(): InviteId | null {
    return this.props.inviteId;
  }

  get inviterId(): UserId | null {
    return this.props.inviterId;
  }

  get inviteeId(): UserId {
    return this.props.inviteeId;
  }

  get status(): RedemptionStatusValue {
    return this.props.status.value;
  }

  get rejectionReason(): RedemptionRejectionReason | null {
    return this.props.rejectionReason;
  }

  get timeZone(): TimeZone {
    return this.props.timeZone;
  }

  get inviterRewardEligible(): boolean {
    return this.props.inviterRewardEligible;
  }

  get activeDays(): readonly Temporal.PlainDate[] {
    return [...this.props.activeDays];
  }

  get joinedAt(): Temporal.Instant {
    return this.props.joinedAt;
  }

  get qualifiedAt(): Temporal.Instant | null {
    return this.props.qualifiedAt;
  }

  get rewardedAt(): Temporal.Instant | null {
    return this.props.rewardedAt;
  }

  get expiresAt(): Temporal.Instant {
    return this.props.expiresAt;
  }

  get qualifyReminderSentAt(): Temporal.Instant | null {
    return this.props.qualifyReminderSentAt;
  }

  isExpiredAt(at: Temporal.Instant): boolean {
    return Temporal.Instant.compare(at, this.props.expiresAt) >= 0;
  }

  hasActiveDay(localDate: Temporal.PlainDate): boolean {
    return this.props.activeDays.some((day) => day.equals(localDate));
  }

  /** 서로 다른 날짜 MIN_ACTIVE_DAYS일에 할 일을 마쳤는지 */
  hasEnoughActiveDays(): boolean {
    return hasEnoughActiveDays(this.props.activeDays.length);
  }

  /** 방금 기록한 날이 첫 활동일인지. 같은 수락의 활동일 기록은 행 잠금으로 직렬화되므로 한 번만 참이다. */
  isOnFirstActiveDay(): boolean {
    return this.props.activeDays.length === 1;
  }

  /**
   * 할 일을 마친 순간을 수락 때 고정한 시간대의 날짜로 센다. 사용 시작 전·만료 전의 새 날짜만 기록하고
   * 같은 날짜를 다시 기록하면 false다.
   */
  recordActivity(occurredAt: Temporal.Instant): boolean {
    if (!this.props.status.is(REDEMPTION_STATUS.JOINED) || this.isExpiredAt(occurredAt)) {
      return false;
    }
    const localDate = localActivityDate(occurredAt, this.props.timeZone);
    if (this.hasActiveDay(localDate)) {
      return false;
    }
    this.props.activeDays = sortedDays([...this.props.activeDays, localDate]);
    return true;
  }

  qualify(now: Temporal.Instant): boolean {
    if (!this.#transitionTo(REDEMPTION_STATUS.QUALIFIED)) {
      return false;
    }
    this.props.qualifiedAt = now;
    return true;
  }

  markRewarded(now: Temporal.Instant): boolean {
    if (!this.#transitionTo(REDEMPTION_STATUS.REWARDED)) {
      return false;
    }
    this.props.rewardedAt = now;
    return true;
  }

  /**
   * 하루만 더 하면 사용 시작인 수락에 마감 전 한 번 알린다. 초대한 사람 보상이 없는 수락은 "발자국을
   * 선물"이 사실이 아니라 보내지 않는다. 오늘 이미 할 일을 끝냈다면 오늘은 더 셀 수 없어 다음 실행으로 넘긴다.
   */
  isQualifyReminderDue(now: Temporal.Instant): boolean {
    return (
      this.props.status.is(REDEMPTION_STATUS.JOINED) &&
      this.props.inviterId != null &&
      this.props.inviterRewardEligible &&
      this.props.qualifyReminderSentAt == null &&
      hasOneActiveDayLeft(this.props.activeDays.length) &&
      !this.isExpiredAt(now) &&
      Temporal.Instant.compare(this.props.expiresAt, qualifyReminderExpiresBefore(now)) <= 0 &&
      !this.hasActiveDay(localActivityDate(now, this.props.timeZone))
    );
  }

  /** 사용 시작 전에만 한 번 기록한다. 이미 보냈거나 JOINED가 아니면 false다. */
  markQualifyReminderSent(now: Temporal.Instant): boolean {
    if (
      !this.props.status.is(REDEMPTION_STATUS.JOINED) ||
      this.props.qualifyReminderSentAt != null
    ) {
      return false;
    }
    this.props.qualifyReminderSentAt = now;
    return true;
  }

  expire(now: Temporal.Instant): boolean {
    if (!this.#transitionTo(REDEMPTION_STATUS.REJECTED)) {
      return false;
    }
    this.props.rejectionReason = REDEMPTION_REJECTION_REASON.EXPIRED;
    this.props.rejectedAt = now;
    return true;
  }

  toPrimitives(): InviteRedemptionPrimitives {
    return {
      id: this.id.value,
      inviteId: this.props.inviteId?.value ?? null,
      inviterId: this.props.inviterId?.value ?? null,
      inviteeId: this.props.inviteeId.value,
      status: this.props.status.value,
      rejectionReason: this.props.rejectionReason,
      timezone: this.props.timeZone.value,
      inviterRewardEligible: this.props.inviterRewardEligible,
      activeDays: [...this.props.activeDays],
      joinedAt: this.props.joinedAt,
      qualifiedAt: this.props.qualifiedAt,
      rewardedAt: this.props.rewardedAt,
      rejectedAt: this.props.rejectedAt,
      expiresAt: this.props.expiresAt,
      qualifyReminderSentAt: this.props.qualifyReminderSentAt,
    };
  }

  #transitionTo(next: RedemptionStatusValue): boolean {
    const status = this.props.status.transitionTo(next);
    if (status == null) {
      return false;
    }
    this.props.status = status;
    return true;
  }
}
