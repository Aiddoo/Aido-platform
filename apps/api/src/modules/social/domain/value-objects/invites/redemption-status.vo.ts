import { ErrorCode } from "@aido/api/errors";
import {
  REDEMPTION_STATUS,
  type RedemptionStatus as RedemptionStatusValue,
} from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export type { RedemptionStatusValue };

// 사용 시작 전 상태에서만 거절되고, 보상 지급 뒤에는 되돌리지 않는다
const ALLOWED_TRANSITIONS: Readonly<
  Record<RedemptionStatusValue, readonly RedemptionStatusValue[]>
> = {
  JOINED: [REDEMPTION_STATUS.QUALIFIED, REDEMPTION_STATUS.REJECTED],
  QUALIFIED: [REDEMPTION_STATUS.REWARDED],
  REWARDED: [],
  REJECTED: [],
};

export class RedemptionStatus {
  private constructor(private readonly value: RedemptionStatusValue) {}

  static joined(): RedemptionStatus {
    return new RedemptionStatus(REDEMPTION_STATUS.JOINED);
  }

  static of(value: string): RedemptionStatus {
    const status = Object.values(REDEMPTION_STATUS).find((candidate) => candidate === value);
    if (status == null) {
      throw new DomainException(ErrorCode.SYS_0001, {
        detail: "Unknown invite redemption status",
        value,
      });
    }
    return new RedemptionStatus(status);
  }

  get raw(): RedemptionStatusValue {
    return this.value;
  }

  is(status: RedemptionStatusValue): boolean {
    return this.value === status;
  }

  /** 같은 상태로의 전이는 멱등으로 보고 null을 반환한다. 허용되지 않은 전이는 예외다. */
  transitionTo(next: RedemptionStatusValue): RedemptionStatus | null {
    if (this.value === next) return null;
    if (!ALLOWED_TRANSITIONS[this.value].includes(next)) {
      throw new DomainException(ErrorCode.SYS_0001, {
        detail: "Invalid invite redemption transition",
        from: this.value,
        to: next,
      });
    }
    return new RedemptionStatus(next);
  }
}
