import { ErrorCode } from "@aido/api/errors";
import type { UserReportReason, UserReportStatus } from "@aido/api/vocabulary";

import { AggregateRoot, DomainException } from "#api/shared/domain/index";

import { UserReportDetail } from "../../value-objects/reports/user-report-detail.vo.js";
import type { UserReportTarget } from "../../value-objects/reports/user-report-target.vo.js";

export interface UserReportProps {
  id: string;
  reporterId: string;
  targetUserId: string;
  target: UserReportTarget;
  reason: UserReportReason;
  detail: string | null;
  status: UserReportStatus;
  createdAt: Date;
}

export interface UserReportCreationInput {
  readonly reporterId: string;
  readonly targetUserId: string;
  readonly target: UserReportTarget;
  readonly reason: UserReportReason;
  readonly detail?: string;
  readonly createdAt: Date;
}

export type UserReportCreationPlan = Omit<UserReportProps, "id" | "status">;

/** 사용자가 다른 사용자의 프로필·콘텐츠를 운영자에게 알린 기록. 운영자가 확인하면 RESOLVED가 된다. */
export class UserReport extends AggregateRoot<UserReportProps> {
  private constructor(props: UserReportProps) {
    super(props);
  }

  static planCreation(input: UserReportCreationInput): UserReportCreationPlan {
    if (input.reporterId === input.targetUserId) {
      throw new DomainException(ErrorCode.REPORT_2251);
    }
    return {
      reporterId: input.reporterId,
      targetUserId: input.targetUserId,
      target: input.target,
      reason: input.reason,
      detail: UserReportDetail.of(input.detail).value,
      createdAt: new Date(input.createdAt),
    };
  }

  static reconstitute(props: UserReportProps): UserReport {
    return new UserReport({ ...props, createdAt: new Date(props.createdAt) });
  }

  get id(): string {
    return this.props.id;
  }

  get reporterId(): string {
    return this.props.reporterId;
  }

  get targetUserId(): string {
    return this.props.targetUserId;
  }

  get target(): UserReportTarget {
    return this.props.target;
  }

  get reason(): UserReportReason {
    return this.props.reason;
  }

  get detail(): string | null {
    return this.props.detail;
  }

  get status(): UserReportStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  isOpen(): boolean {
    return this.props.status === "OPEN";
  }

  resolve(): boolean {
    if (!this.isOpen()) {
      return false;
    }
    this.props.status = "RESOLVED";
    return true;
  }
}
