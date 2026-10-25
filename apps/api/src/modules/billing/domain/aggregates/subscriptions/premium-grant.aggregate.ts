import { AggregateRoot } from "#api/shared/domain/index";

import {
  isPremiumGrantEnded,
  premiumGrantEndsAt,
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
>;

// 종료 안내 시각은 안내 작업이 조건부 UPDATE로만 기록하므로 여기서 덮어쓰지 않는다
export type PremiumGrantPersistenceState = Pick<
  PremiumGrantProps,
  "status" | "startsAt" | "endsAt"
>;

function copyDate(value: Date | null): Date | null {
  return value === null ? null : new Date(value);
}

export class PremiumGrant extends AggregateRoot<PremiumGrantProps> {
  private constructor(props: PremiumGrantProps) {
    super(props);
  }

  static planCreation(input: PremiumGrantCreationInput): PremiumGrantCreationPlan {
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
    this.props.endsAt = premiumGrantEndsAt(startsAt, this.props.durationDays);
    return true;
  }

  /** 끝나는 시각이 지난 ACTIVE 기간만 끝낸다. */
  end(at: Date): boolean {
    if (!isPremiumGrantEnded(this, at)) {
      return false;
    }
    this.props.status = "ENDED";
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
