import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export type FriendshipStatusValue = "PENDING" | "ACCEPTED";

export class FriendshipStatus {
  private constructor(private readonly value: FriendshipStatusValue) {}

  static pending(): FriendshipStatus {
    return new FriendshipStatus("PENDING");
  }

  static accepted(): FriendshipStatus {
    return new FriendshipStatus("ACCEPTED");
  }

  static of(value: string): FriendshipStatus {
    if (value !== "PENDING" && value !== "ACCEPTED") {
      throw new DomainException(ErrorCode.SYS_0001, {
        detail: "Unknown friendship status",
        value,
      });
    }
    return new FriendshipStatus(value);
  }

  get raw(): FriendshipStatusValue {
    return this.value;
  }

  isPending(): boolean {
    return this.value === "PENDING";
  }

  isAccepted(): boolean {
    return this.value === "ACCEPTED";
  }

  accept(): FriendshipStatus {
    return FriendshipStatus.accepted();
  }

  equals(other: FriendshipStatus): boolean {
    return this.value === other.value;
  }
}
