import { AggregateRoot } from "#api/shared/domain/index";

import {
  getAiQuotaPeriodId,
  isCurrentAiQuotaPeriod,
} from "../../policies/quotas/ai-quota-period.policy.js";

export interface AiQuotaUsageProps {
  readonly userId: string;
  count: number;
  resetAt: Date | null;
}

export interface AiQuotaUsageSnapshot {
  readonly count: number;
  readonly resetAt: Date | null;
}

export type AiQuotaReservationDecision =
  | {
      readonly status: "reserved";
      readonly periodId: string;
      readonly usage: { readonly count: number; readonly resetAt: Date };
    }
  | { readonly status: "exceeded"; readonly used: number; readonly limit: number };

export interface AiQuotaRelease {
  readonly count: number;
  readonly expectedResetAt: Date;
}

export class AiQuotaUsage extends AggregateRoot<AiQuotaUsageProps> {
  static reconstitute(props: AiQuotaUsageProps): AiQuotaUsage {
    return new AiQuotaUsage({
      userId: props.userId,
      count: props.count,
      resetAt: props.resetAt === null ? null : new Date(props.resetAt),
    });
  }

  get userId(): string {
    return this.props.userId;
  }

  get snapshot(): AiQuotaUsageSnapshot {
    return {
      count: this.props.count,
      resetAt: this.props.resetAt === null ? null : new Date(this.props.resetAt),
    };
  }

  usedAt(at: Date): number {
    return isCurrentAiQuotaPeriod(this.props.resetAt, at) ? this.props.count : 0;
  }

  reserve(input: { readonly at: Date; readonly limit: number | null }): AiQuotaReservationDecision {
    const used = this.usedAt(input.at);
    if (input.limit !== null && used >= input.limit) {
      return { status: "exceeded", used, limit: input.limit };
    }

    if (!isCurrentAiQuotaPeriod(this.props.resetAt, input.at)) {
      this.props.resetAt = new Date(input.at);
    }
    this.props.count = used + 1;
    return {
      status: "reserved",
      periodId: getAiQuotaPeriodId(input.at),
      usage: {
        count: this.props.count,
        resetAt: new Date(this.props.resetAt ?? input.at),
      },
    };
  }

  release(periodId: string): AiQuotaRelease | null {
    if (
      this.props.resetAt === null ||
      getAiQuotaPeriodId(this.props.resetAt) !== periodId ||
      this.props.count <= 0
    ) {
      return null;
    }

    this.props.count -= 1;
    return { count: this.props.count, expectedResetAt: new Date(this.props.resetAt) };
  }
}
