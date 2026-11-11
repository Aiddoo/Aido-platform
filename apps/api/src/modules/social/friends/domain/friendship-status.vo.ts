import { ErrorCode } from "@aido/api/errors";
import { FOLLOW_STATUSES } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { ValueObject } from "#api/shared/domain/model/value-object";

export type FriendshipStatusValue = (typeof FOLLOW_STATUSES)[number];

function isFriendshipStatusValue(raw: string): raw is FriendshipStatusValue {
  return FOLLOW_STATUSES.some((status) => status === raw);
}

export class FriendshipStatus extends ValueObject<FriendshipStatusValue> {
  static create(raw: string): FriendshipStatus {
    if (!isFriendshipStatusValue(raw)) {
      throw new DomainException(ErrorCode.SYS_0001, {
        detail: "Unknown friendship status",
        value: raw,
      });
    }
    return new FriendshipStatus(raw);
  }

  static reconstitute(raw: FriendshipStatusValue): FriendshipStatus {
    return new FriendshipStatus(raw);
  }

  isPending(): boolean {
    return this.value === "PENDING";
  }

  isAccepted(): boolean {
    return this.value === "ACCEPTED";
  }
}
