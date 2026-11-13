import { FOLLOW_STATUSES } from "@aido/api/vocabulary";

import { ValueObject } from "#api/shared/domain/model/value-object";

import { unknownFriendshipStatus } from "./friends.errors.js";

export type FriendshipStatusValue = (typeof FOLLOW_STATUSES)[number];

function isFriendshipStatusValue(raw: string): raw is FriendshipStatusValue {
  return FOLLOW_STATUSES.some((status) => status === raw);
}

export class FriendshipStatus extends ValueObject<FriendshipStatusValue> {
  static create(raw: string): FriendshipStatus {
    if (!isFriendshipStatusValue(raw)) {
      throw unknownFriendshipStatus(raw);
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
