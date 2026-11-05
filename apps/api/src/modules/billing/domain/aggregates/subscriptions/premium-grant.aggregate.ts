import { ErrorCode } from "@aido/api/errors";

import { AggregateRoot, DomainException } from "#api/shared/domain/index";

import {
  isPremiumGrantActive,
  isPremiumGrantEnded,
  premiumGrantDaysOf,
  premiumGrantEndsAt,
  premiumGrantTermEndsAt,
  remainingPremiumGrantMs,
  type PremiumGrantStart,
  type PremiumGrantStatusValue,
} from "../../policies/subscriptions/premium-access.policy.js";

export type { PremiumGrantStatusValue };
export type PremiumGrantSourceValue = "INVITE";

export interface PremiumGrantProps {
  id: string;
  userId: string;
  source: PremiumGrantSourceValue;
  sourceKey: string;
  durationDays: number;
  /** 끊고 남은 기간의 정확한 길이. null이면 durationDays일이다. */
  durationMs: number | null;
  status: PremiumGrantStatusValue;
  startsAt: Date | null;
  endsAt: Date | null;
  endingNotifiedAt: Date | null;
  createdAt: Date;
}

export interface PremiumGrantCreationInput {
  readonly userId: string;
  readonly source: PremiumGrantSourceValue;
  readonly sourceKey: string;
  readonly durationDays: number;
  readonly start: PremiumGrantStart;
}

export type PremiumGrantCreationPlan = Pick<
  PremiumGrantProps,
  "userId" | "source" | "sourceKey" | "durationDays" | "status" | "startsAt" | "endsAt"
> & {
  /** 끊고 남은 기간의 정확한 길이. 비우면 durationDays일이다. */
  readonly durationMs?: number | null;
  /** 받은 순서(이어 붙이는 순서). 비우면 저장 시각이다. */
  readonly createdAt?: Date;
};

/** 진행 중에 끊은 기간의 남은 일수를 다시 쌓아 둔 기간의 출처 키. 끊긴 기간마다 하나뿐이다. */
export function bankedRemainderSourceKey(grantId: string): string {
  return `rebank:${grantId}`;
}

// 종료 안내 시각은 안내 작업이 조건부 UPDATE로만 기록하므로 여기서 덮어쓰지 않는다
export type PremiumGrantPersistenceState = Pick<
  PremiumGrantProps,
  "status" | "startsAt" | "endsAt"
>;

/** PremiumGrant.sourceKey VARCHAR(128) */
export const PREMIUM_GRANT_SOURCE_KEY_MAX_LENGTH = 128;

function copyDate(value: Date | null): Date | null {
  return value == null ? null : new Date(value);
}

export class PremiumGrant extends AggregateRoot<PremiumGrantProps> {
  private constructor(props: PremiumGrantProps) {
    super(props);
  }

  static planCreation(input: PremiumGrantCreationInput): PremiumGrantCreationPlan {
    // 0일·음수 기간은 바로 끝나는 ACTIVE 기간을 만들고, 긴 sourceKey는 DB 오류로 늦게 드러난다
    if (!Number.isInteger(input.durationDays) || input.durationDays <= 0) {
      throw new DomainException(ErrorCode.SYS_0002, {
        field: "durationDays",
        durationDays: input.durationDays,
      });
    }
    if (
      input.sourceKey.length === 0 ||
      input.sourceKey.length > PREMIUM_GRANT_SOURCE_KEY_MAX_LENGTH
    ) {
      throw new DomainException(ErrorCode.SYS_0002, {
        field: "sourceKey",
        length: input.sourceKey.length,
      });
    }
    const base = {
      userId: input.userId,
      source: input.source,
      sourceKey: input.sourceKey,
      durationDays: input.durationDays,
    };
    if (input.start.kind === "bank") {
      return { ...base, status: "BANKED", startsAt: null, endsAt: null };
    }
    return {
      ...base,
      status: "ACTIVE",
      startsAt: new Date(input.start.startsAt),
      endsAt: premiumGrantEndsAt(input.start.startsAt, input.durationDays),
    };
  }

  static reconstitute(props: PremiumGrantProps): PremiumGrant {
    return new PremiumGrant({
      ...props,
      startsAt: copyDate(props.startsAt),
      endsAt: copyDate(props.endsAt),
      endingNotifiedAt: copyDate(props.endingNotifiedAt),
      createdAt: new Date(props.createdAt),
    });
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get durationDays(): number {
    return this.props.durationDays;
  }

  get durationMs(): number | null {
    return this.props.durationMs;
  }

  get status(): PremiumGrantStatusValue {
    return this.props.status;
  }

  get startsAt(): Date | null {
    return copyDate(this.props.startsAt);
  }

  get endsAt(): Date | null {
    return copyDate(this.props.endsAt);
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  /** 쌓아 둔 기간을 이어서 시작한다. 이미 시작했으면 false다. */
  activate(startsAt: Date): boolean {
    if (this.props.status !== "BANKED") {
      return false;
    }
    this.props.status = "ACTIVE";
    this.props.startsAt = new Date(startsAt);
    this.props.endsAt = premiumGrantTermEndsAt(startsAt, this.props);
    return true;
  }

  /** 아직 시작하지 않은 ACTIVE 기간을 다시 쌓아 둔다. 이미 시작했거나 BANKED면 false다. */
  returnToBank(at: Date): boolean {
    if (
      this.props.status !== "ACTIVE" ||
      this.props.startsAt == null ||
      this.props.startsAt.getTime() <= at.getTime()
    ) {
      return false;
    }
    this.props.status = "BANKED";
    this.props.startsAt = null;
    this.props.endsAt = null;
    return true;
  }

  /**
   * 진행 중인 기간을 지금 끝내고 남은 기간을 이어 받을 BANKED 기간 계획을 반환한다.
   * 남은 길이는 ms 그대로 남기고 표시 일수만 올린다. 같은 기간을 여러 번 끊어도 늘거나 줄지 않는다.
   * 아직 시작하지 않았거나 이미 끝난 기간이면 null이다. 처음 받은 순서를 지켜 다른 쌓아 둔 기간보다
   * 먼저 이어 붙는다.
   */
  splitAt(at: Date): PremiumGrantCreationPlan | null {
    if (
      !isPremiumGrantActive(this, at) ||
      this.props.startsAt == null ||
      this.props.startsAt.getTime() > at.getTime()
    ) {
      return null;
    }
    const remainingMs = remainingPremiumGrantMs(this, at);
    this.props.status = "ENDED";
    this.props.endsAt = new Date(at);
    return {
      userId: this.props.userId,
      source: this.props.source,
      sourceKey: bankedRemainderSourceKey(this.props.id),
      durationDays: premiumGrantDaysOf(remainingMs),
      durationMs: remainingMs,
      status: "BANKED",
      startsAt: null,
      endsAt: null,
      createdAt: new Date(this.props.createdAt),
    };
  }

  /** 끝나는 시각이 지난 ACTIVE 기간만 끝낸다. */
  end(at: Date): boolean {
    if (!isPremiumGrantEnded(this, at)) {
      return false;
    }
    this.props.status = "ENDED";
    return true;
  }

  /**
   * 지급을 취소한다. 쌓아 둔 기간은 시작하지 않고, 진행 중인 기간은 지금 끝낸다.
   * 이미 끝났거나 취소한 기간은 바꾸지 않고 false다.
   */
  revoke(at: Date): boolean {
    if (this.props.status !== "BANKED" && this.props.status !== "ACTIVE") {
      return false;
    }
    if (this.props.status === "ACTIVE" && isPremiumGrantEnded(this, at)) {
      return false;
    }
    if (
      this.props.status === "ACTIVE" &&
      this.props.endsAt != null &&
      this.props.endsAt.getTime() > at.getTime()
    ) {
      this.props.endsAt = new Date(at);
    }
    this.props.status = "REVOKED";
    return true;
  }

  toPersistence(): PremiumGrantPersistenceState {
    return {
      status: this.props.status,
      startsAt: this.startsAt,
      endsAt: this.endsAt,
    };
  }
}
