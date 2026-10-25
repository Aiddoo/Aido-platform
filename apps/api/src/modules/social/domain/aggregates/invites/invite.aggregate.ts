import { AggregateRoot } from "#api/shared/domain/index";

import type { InviteCode } from "../../value-objects/invites/invite-code.vo.js";

export type InviteStatusValue = "ACTIVE" | "REVOKED";

export interface InviteProps {
  id: string;
  inviterId: string;
  code: string;
  status: InviteStatusValue;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface InviteIssueInput {
  readonly inviterId: string;
  readonly code: InviteCode;
  readonly issuedAt: Date;
}

export interface InviteIssuePlan {
  readonly inviterId: string;
  readonly code: string;
  readonly status: "ACTIVE";
  readonly createdAt: Date;
}

export class Invite extends AggregateRoot<InviteProps> {
  private constructor(props: InviteProps) {
    super(props);
  }

  static planIssue(input: InviteIssueInput): InviteIssuePlan {
    return {
      inviterId: input.inviterId,
      code: input.code.value,
      status: "ACTIVE",
      createdAt: new Date(input.issuedAt),
    };
  }

  static reconstitute(props: InviteProps): Invite {
    return new Invite({
      id: props.id,
      inviterId: props.inviterId,
      code: props.code,
      status: props.status,
      createdAt: new Date(props.createdAt),
      revokedAt: props.revokedAt === null ? null : new Date(props.revokedAt),
    });
  }

  get id(): string {
    return this.props.id;
  }

  get inviterId(): string {
    return this.props.inviterId;
  }

  get code(): string {
    return this.props.code;
  }

  get status(): InviteStatusValue {
    return this.props.status;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get revokedAt(): Date | null {
    return this.props.revokedAt === null ? null : new Date(this.props.revokedAt);
  }

  isActive(): boolean {
    return this.props.status === "ACTIVE";
  }

  isIssuedBy(userId: string): boolean {
    return this.props.inviterId === userId;
  }

  /** 재발급은 기존 코드를 폐기한다. 폐기한 코드는 행을 남겨 다시 쓰지 않는다. */
  revoke(revokedAt: Date): boolean {
    if (!this.isActive()) {
      return false;
    }
    this.props.status = "REVOKED";
    this.props.revokedAt = new Date(revokedAt);
    return true;
  }
}
