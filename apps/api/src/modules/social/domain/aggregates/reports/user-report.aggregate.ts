import { ErrorCode } from "@aido/api/errors";
import type { UserReportReason, UserReportStatus } from "@aido/api/vocabulary";

import { AggregateRoot, DomainException } from "#api/shared/domain/index";

import { UserReportDetail } from "../../value-objects/reports/user-report-detail.vo.js";
import { UserReportResolutionNote } from "../../value-objects/reports/user-report-resolution-note.vo.js";
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
  resolvedAt: Date | null;
  resolvedById: string | null;
  resolutionNote: string | null;
}

export interface UserReportResolutionInput {
  readonly resolvedById: string;
  readonly note: string;
  readonly resolvedAt: Date;
}

export interface UserReportCreationInput {
  readonly reporterId: string;
  readonly targetUserId: string;
  readonly target: UserReportTarget;
  readonly reason: UserReportReason;
  readonly detail?: string;
  readonly createdAt: Date;
}

export type UserReportCreationPlan = Omit<
  UserReportProps,
  "id" | "status" | "resolvedAt" | "resolvedById" | "resolutionNote"
>;

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
    return new UserReport({
      ...props,
      createdAt: new Date(props.createdAt),
      resolvedAt: props.resolvedAt == null ? null : new Date(props.resolvedAt),
    });
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

  get resolvedAt(): Date | null {
    return this.props.resolvedAt == null ? null : new Date(this.props.resolvedAt);
  }

  get resolvedById(): string | null {
    return this.props.resolvedById;
  }

  get resolutionNote(): string | null {
    return this.props.resolutionNote;
  }

  /** 운영자가 조치를 남기고 처리를 마친다. 이미 처리한 신고는 첫 처리 기록을 유지하고 false를 돌려준다 */
  resolve(input: UserReportResolutionInput): boolean {
    const note = UserReportResolutionNote.of(input.note);
    if (!this.isOpen()) {
      return false;
    }
    this.props.status = "RESOLVED";
    this.props.resolvedAt = new Date(input.resolvedAt);
    this.props.resolvedById = input.resolvedById;
    this.props.resolutionNote = note.value;
    return true;
  }
}
