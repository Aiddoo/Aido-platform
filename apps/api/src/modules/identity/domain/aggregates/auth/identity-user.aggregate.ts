import { ErrorCode } from "@aido/api/errors";

import { subtractDays } from "#api/shared/domain/date/utils/arithmetic";
import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { AggregateRoot } from "#api/shared/domain/index";

import { ACCOUNT_DELETION } from "../../constants/auth/auth.constants.js";
import type { UserStatus } from "../../types/auth/auth.types.js";

export interface IdentityUserProps {
  id: string;
  status: UserStatus;
  deletedAt: Date | null;
}

export class IdentityUser extends AggregateRoot<IdentityUserProps> {
  static reconstitute(props: IdentityUserProps): IdentityUser {
    return new IdentityUser({
      id: props.id,
      status: props.status,
      deletedAt: props.deletedAt !== null ? new Date(props.deletedAt) : null,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get status(): UserStatus {
    return this.props.status;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt !== null ? new Date(this.props.deletedAt) : null;
  }

  requiresRestoration(at: Date): boolean {
    if (this.props.deletedAt === null) {
      return false;
    }

    if (this.props.deletedAt > subtractDays(ACCOUNT_DELETION.GRACE_PERIOD_DAYS, at)) {
      return true;
    }

    throw new DomainException(ErrorCode.USER_0606, { userId: this.id });
  }

  requestDeletion(at: Date): void {
    if (this.props.deletedAt !== null) {
      throw new DomainException(ErrorCode.USER_0606, { userId: this.id });
    }

    this.props.status = "SUSPENDED";
    this.props.deletedAt = new Date(at);
  }

  restore(at: Date): void {
    if (!this.requiresRestoration(at)) {
      return;
    }

    this.props.status = "ACTIVE";
    this.props.deletedAt = null;
  }

  isPurgeEligibleAt(at: Date): boolean {
    return (
      this.props.deletedAt !== null &&
      this.props.deletedAt < subtractDays(ACCOUNT_DELETION.GRACE_PERIOD_DAYS, at)
    );
  }
}
