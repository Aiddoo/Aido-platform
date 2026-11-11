import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { InviteCode } from "./invite-code.vo.js";
import { InviteId } from "./invite-id.vo.js";
import type { InviteStatus } from "./invites.constants.js";

export interface InvitePrimitives {
  readonly id: string;
  readonly inviterId: string;
  readonly code: string;
  readonly status: InviteStatus;
  readonly createdAt: Temporal.Instant;
  readonly revokedAt: Temporal.Instant | null;
}

interface InviteProps {
  readonly inviterId: UserId;
  readonly code: InviteCode;
  status: InviteStatus;
  readonly createdAt: Temporal.Instant;
  revokedAt: Temporal.Instant | null;
}

interface CreateInviteParams {
  readonly id: InviteId;
  readonly inviterId: UserId;
  readonly code: InviteCode;
  readonly now: Temporal.Instant;
}

export class Invite extends AggregateRoot<InviteId, InviteProps> {
  static create(params: CreateInviteParams): Invite {
    return new Invite(params.id, {
      inviterId: params.inviterId,
      code: params.code,
      status: "ACTIVE",
      createdAt: params.now,
      revokedAt: null,
    });
  }

  static reconstitute(primitives: InvitePrimitives): Invite {
    return new Invite(InviteId.reconstitute(primitives.id), {
      inviterId: UserId.reconstitute(primitives.inviterId),
      code: InviteCode.reconstitute(primitives.code),
      status: primitives.status,
      createdAt: primitives.createdAt,
      revokedAt: primitives.revokedAt,
    });
  }

  get inviterId(): UserId {
    return this.props.inviterId;
  }

  get code(): InviteCode {
    return this.props.code;
  }

  get status(): InviteStatus {
    return this.props.status;
  }

  get createdAt(): Temporal.Instant {
    return this.props.createdAt;
  }

  get revokedAt(): Temporal.Instant | null {
    return this.props.revokedAt;
  }

  isActive(): boolean {
    return this.props.status === "ACTIVE";
  }

  isIssuedBy(userId: UserId): boolean {
    return this.props.inviterId.equals(userId);
  }

  /** 재발급은 기존 코드를 폐기한다. 폐기한 코드는 행을 남겨 다시 쓰지 않는다. */
  revoke(now: Temporal.Instant): boolean {
    if (!this.isActive()) {
      return false;
    }
    this.props.status = "REVOKED";
    this.props.revokedAt = now;
    return true;
  }

  toPrimitives(): InvitePrimitives {
    return {
      id: this.id.value,
      inviterId: this.props.inviterId.value,
      code: this.props.code.value,
      status: this.props.status,
      createdAt: this.props.createdAt,
      revokedAt: this.props.revokedAt,
    };
  }
}
