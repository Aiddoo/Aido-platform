import type {
  UserReportReason,
  UserReportStatus,
  UserReportTargetType,
} from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { cannotReportSelf } from "./reports.errors.js";
import { UserReportDetail } from "./user-report-detail.vo.js";
import { UserReportId } from "./user-report-id.vo.js";
import { UserReportResolutionNote } from "./user-report-resolution-note.vo.js";
import { UserReportTarget } from "./user-report-target.vo.js";

export interface UserReportPrimitives {
  readonly id: string;
  readonly reporterId: string;
  readonly targetUserId: string;
  readonly targetType: UserReportTargetType;
  readonly targetId: string | null;
  readonly reason: UserReportReason;
  readonly detail: string | null;
  readonly status: UserReportStatus;
  readonly createdAt: Temporal.Instant;
  readonly resolvedAt: Temporal.Instant | null;
  readonly resolvedById: string | null;
  readonly resolutionNote: string | null;
}

// 조건부 저장(saveIfUnchanged)이 비교하는 읽은 때의 상태
export interface UserReportVersion {
  readonly status: UserReportStatus;
}

interface UserReportProps {
  readonly reporterId: UserId;
  readonly targetUserId: UserId;
  readonly target: UserReportTarget;
  readonly reason: UserReportReason;
  readonly detail: UserReportDetail;
  status: UserReportStatus;
  readonly createdAt: Temporal.Instant;
  resolvedAt: Temporal.Instant | null;
  resolvedById: UserId | null;
  resolutionNote: UserReportResolutionNote | null;
}

interface CreateUserReportParams {
  readonly id: UserReportId;
  readonly reporterId: UserId;
  readonly targetUserId: UserId;
  readonly target: UserReportTarget;
  readonly reason: UserReportReason;
  readonly detail?: string;
  readonly now: Temporal.Instant;
}

interface ResolveUserReportParams {
  readonly resolvedById: UserId;
  readonly note: UserReportResolutionNote;
  readonly now: Temporal.Instant;
}

// 사용자가 다른 사용자의 프로필·콘텐츠를 운영자에게 알린 기록. 운영자가 조치를 남기면 RESOLVED가 된다
export class UserReport extends AggregateRoot<UserReportId, UserReportProps> {
  static create(params: CreateUserReportParams): UserReport {
    // 자기 신고를 상세 내용 검증보다 먼저 거부한다(출시 앱이 받는 오류 우선순위)
    if (params.reporterId.equals(params.targetUserId)) {
      throw cannotReportSelf();
    }
    return new UserReport(params.id, {
      reporterId: params.reporterId,
      targetUserId: params.targetUserId,
      target: params.target,
      reason: params.reason,
      detail: UserReportDetail.create(params.detail),
      status: "OPEN",
      createdAt: params.now,
      resolvedAt: null,
      resolvedById: null,
      resolutionNote: null,
    });
  }

  static reconstitute(primitives: UserReportPrimitives): UserReport {
    return new UserReport(UserReportId.reconstitute(primitives.id), {
      reporterId: UserId.reconstitute(primitives.reporterId),
      targetUserId: UserId.reconstitute(primitives.targetUserId),
      target: UserReportTarget.reconstitute({
        type: primitives.targetType,
        contentId: primitives.targetId,
      }),
      reason: primitives.reason,
      detail: UserReportDetail.reconstitute(primitives.detail),
      status: primitives.status,
      createdAt: primitives.createdAt,
      resolvedAt: primitives.resolvedAt,
      resolvedById:
        primitives.resolvedById == null ? null : UserId.reconstitute(primitives.resolvedById),
      resolutionNote:
        primitives.resolutionNote == null
          ? null
          : UserReportResolutionNote.reconstitute(primitives.resolutionNote),
    });
  }

  get reporterId(): UserId {
    return this.props.reporterId;
  }

  get targetUserId(): UserId {
    return this.props.targetUserId;
  }

  get target(): UserReportTarget {
    return this.props.target;
  }

  get reason(): UserReportReason {
    return this.props.reason;
  }

  get detail(): UserReportDetail {
    return this.props.detail;
  }

  get status(): UserReportStatus {
    return this.props.status;
  }

  get createdAt(): Temporal.Instant {
    return this.props.createdAt;
  }

  get resolvedAt(): Temporal.Instant | null {
    return this.props.resolvedAt;
  }

  get resolvedById(): UserId | null {
    return this.props.resolvedById;
  }

  get resolutionNote(): UserReportResolutionNote | null {
    return this.props.resolutionNote;
  }

  get version(): UserReportVersion {
    return { status: this.props.status };
  }

  // 이미 처리한 신고는 첫 처리 기록을 그대로 둔다
  resolve(params: ResolveUserReportParams): boolean {
    if (this.props.status !== "OPEN") {
      return false;
    }
    this.props.status = "RESOLVED";
    this.props.resolvedAt = params.now;
    this.props.resolvedById = params.resolvedById;
    this.props.resolutionNote = params.note;
    return true;
  }

  toPrimitives(): UserReportPrimitives {
    return {
      id: this.id.value,
      reporterId: this.props.reporterId.value,
      targetUserId: this.props.targetUserId.value,
      targetType: this.props.target.type,
      targetId: this.props.target.contentId,
      reason: this.props.reason,
      detail: this.props.detail.value,
      status: this.props.status,
      createdAt: this.props.createdAt,
      resolvedAt: this.props.resolvedAt,
      resolvedById: this.props.resolvedById?.value ?? null,
      resolutionNote: this.props.resolutionNote?.value ?? null,
    };
  }
}
