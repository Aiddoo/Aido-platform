import { ErrorCode } from "@aido/api/errors";
import type { UserReportReason, UserReportTargetType } from "@aido/api/vocabulary";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import {
  UserReport,
  type UserReportCreationPlan,
} from "../../../domain/aggregates/reports/user-report.aggregate.js";
import {
  dailyReportWindowStart,
  duplicateReportWindowStart,
  hasReachedDailyReportLimit,
} from "../../../domain/policies/reports/user-report-submission.policy.js";
import { UserReportTarget } from "../../../domain/value-objects/reports/user-report-target.vo.js";
import { SocialReportLogEvent } from "../../observability/reports/social-report-log.events.js";
import { type UserReportNotifierPort } from "../../ports/reports/user-report-notifier.port.js";
import { type UserReportRepositoryPort } from "../../ports/reports/user-report.repository.port.js";
import { buildUserReportSubmission } from "../../services/reports/user-report-submission.factory.js";

export interface ReportContentInput {
  readonly reporterId: string;
  readonly targetUserId: string;
  readonly targetType: UserReportTargetType;
  readonly targetId?: string;
  readonly reason: UserReportReason;
  readonly detail?: string;
}

export interface ReportContentResult {
  readonly report: UserReport;
  /** 24시간 안에 같은 대상을 이미 신고해 새로 접수하지 않았으면 true */
  readonly isDuplicate: boolean;
}

interface ReportContentDependencies {
  readonly userReportRepository: Pick<
    UserReportRepositoryPort,
    "userExists" | "findRecentByTarget" | "countByReporterSince" | "create" | "findUserTags"
  >;
  readonly notifier: Pick<UserReportNotifierPort, "notifyOperators">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly logger: Pick<ApplicationLogger, "log" | "warn">;
}

/**
 * 프로필·콘텐츠 신고를 접수하고 운영자에게 알린다.
 *
 * 같은 대상을 24시간 안에 다시 신고하면 기존 접수를 돌려줘 운영자 알림이 쌓이지 않게 한다.
 * 알림은 commit 뒤에 보내고, 실패해도 저장한 신고는 남겨 운영자가 DB에서 확인할 수 있게 한다.
 */
export class ReportContent {
  readonly #dependencies: ReportContentDependencies;

  constructor(dependencies: ReportContentDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ReportContentInput): Promise<ReportContentResult> {
    const submittedAt = now();
    const plan = UserReport.planCreation({
      reporterId: input.reporterId,
      targetUserId: input.targetUserId,
      target: UserReportTarget.of(input.targetType, input.targetId ?? null),
      reason: input.reason,
      detail: input.detail,
      createdAt: submittedAt,
    });

    const result = await this.#dependencies.unitOfWork.run(() => this.#submit(plan));

    if (result.isDuplicate) {
      this.#dependencies.logger.log({
        event: SocialReportLogEvent.DUPLICATE_IGNORED,
        userId: input.reporterId,
        reportId: result.report.id,
      });
      return result;
    }

    this.#dependencies.logger.log({
      event: SocialReportLogEvent.SUBMITTED,
      userId: input.reporterId,
      targetUserId: input.targetUserId,
      reportId: result.report.id,
      targetType: input.targetType,
      reason: input.reason,
    });
    await this.#notifyOperators(result.report);
    return result;
  }

  async #submit(plan: UserReportCreationPlan): Promise<ReportContentResult> {
    // 같은 신고자의 연속 요청을 직렬화해 중복 판정과 하루 한도가 동시에 새지 않게 한다.
    await this.#dependencies.mutationLock.acquire([MutationLockKeys.userReport(plan.reporterId)]);

    const isTargetActive = await this.#dependencies.userReportRepository.userExists(
      plan.targetUserId,
    );
    if (!isTargetActive) {
      throw new ApplicationException(ErrorCode.REPORT_2252, { targetUserId: plan.targetUserId });
    }

    const duplicate = await this.#dependencies.userReportRepository.findRecentByTarget({
      reporterId: plan.reporterId,
      targetUserId: plan.targetUserId,
      target: plan.target,
      since: duplicateReportWindowStart(plan.createdAt),
    });
    if (duplicate != null) {
      return { report: duplicate, isDuplicate: true };
    }

    const recentCount = await this.#dependencies.userReportRepository.countByReporterSince(
      plan.reporterId,
      dailyReportWindowStart(plan.createdAt),
    );
    if (hasReachedDailyReportLimit(recentCount)) {
      throw new ApplicationException(ErrorCode.REPORT_2254, { current: recentCount });
    }

    const report = await this.#dependencies.userReportRepository.create(plan);
    return { report, isDuplicate: false };
  }

  async #notifyOperators(report: UserReport): Promise<void> {
    try {
      const userTags = await this.#dependencies.userReportRepository.findUserTags([
        report.reporterId,
        report.targetUserId,
      ]);
      const delivery = await this.#dependencies.notifier.notifyOperators(
        buildUserReportSubmission(report, userTags),
      );
      if (!delivery.success) {
        this.#dependencies.logger.warn({
          event: SocialReportLogEvent.OPERATOR_NOTIFY_FAILED,
          reportId: report.id,
          errorType: "delivery-rejected",
        });
      }
    } catch {
      this.#dependencies.logger.warn({
        event: SocialReportLogEvent.OPERATOR_NOTIFY_FAILED,
        reportId: report.id,
        errorType: "delivery-error",
      });
    }
  }
}
