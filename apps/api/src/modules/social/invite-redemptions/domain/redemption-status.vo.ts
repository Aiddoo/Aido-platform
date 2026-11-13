import {
  REDEMPTION_STATUS,
  type RedemptionStatus as RedemptionStatusValue,
} from "@aido/api/vocabulary";

import { ValueObject } from "#api/shared/domain/model/value-object";

import {
  invalidRedemptionTransition,
  unknownRedemptionStatus,
} from "./invite-redemptions.errors.js";

const REDEMPTION_STATUS_VALUES: readonly RedemptionStatusValue[] = Object.values(REDEMPTION_STATUS);

// 사용 시작 전 상태에서만 거절되고, 보상 지급 뒤에는 되돌리지 않는다
const ALLOWED_TRANSITIONS: Readonly<
  Record<RedemptionStatusValue, readonly RedemptionStatusValue[]>
> = {
  JOINED: [REDEMPTION_STATUS.QUALIFIED, REDEMPTION_STATUS.REJECTED],
  QUALIFIED: [REDEMPTION_STATUS.REWARDED],
  REWARDED: [],
  REJECTED: [],
};

export class RedemptionStatus extends ValueObject<RedemptionStatusValue> {
  static readonly JOINED: RedemptionStatus = new RedemptionStatus(REDEMPTION_STATUS.JOINED);

  static create(raw: string): RedemptionStatus {
    const status = REDEMPTION_STATUS_VALUES.find((candidate) => candidate === raw);
    if (status == null) {
      throw unknownRedemptionStatus(raw);
    }
    return new RedemptionStatus(status);
  }

  static reconstitute(value: RedemptionStatusValue): RedemptionStatus {
    return new RedemptionStatus(value);
  }

  is(status: RedemptionStatusValue): boolean {
    return this.value === status;
  }

  /** 같은 상태로의 전이는 멱등으로 보고 null을 반환한다. 허용되지 않은 전이는 예외다. */
  transitionTo(next: RedemptionStatusValue): RedemptionStatus | null {
    if (this.value === next) {
      return null;
    }
    if (!ALLOWED_TRANSITIONS[this.value].includes(next)) {
      throw invalidRedemptionTransition(this.value, next);
    }
    return new RedemptionStatus(next);
  }
}
