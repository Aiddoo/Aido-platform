import { ErrorCode } from "@aido/api/errors";
import type { UserReportReason, UserReportTargetType } from "@aido/api/vocabulary";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";

import {
  dailyReportWindowStart,
  duplicateReportWindowStart,
  hasReachedDailyReportLimit,
} from "../../domain/user-report-submission.domain-service.js";
import { UserReportTarget } from "../../domain/user-report-target.vo.js";
import { UserReport, type UserReportCreationPlan } from "../../domain/user-report.aggregate.js";
import { type UserReportNotifierPort } from "../ports/user-report-notifier.port.js";
import { type UserReportRepositoryPort } from "../ports/user-report.repository.port.js";
import { UserReportLogEvent } from "../reports.log-events.js";
import { buildUserReportSubmission } from "../user-report-submission.mapper.js";

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
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn">;
}

/**
 * 프로필·콘텐츠 신고를 접수하고 운영자에게 알린다.
 *
 * 같은 대상을 24시간 안에 다시 신고하면 기존 접수를 돌려줘 운영자 알림이 쌓이지 않게 한다.
 * 알림은 commit 뒤에 보내고, 실패해도 저장한 신고는 남겨 운영자가 DB에서 확인할 수 있게 한다.
 */
export class ReportContentUseCase {
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
        event: UserReportLogEvent.DUPLICATE_IGNORED,
        userId: input.reporterId,
        reportId: result.report.id,
      });
      return result;
    }

    this.#dependencies.logger.log({
      event: UserReportLogEvent.SUBMITTED,
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
      if (delivery.status === "rejected") {
        this.#dependencies.logger.warn({
          event: UserReportLogEvent.OPERATOR_NOTIFY_FAILED,
          reportId: report.id,
          errorType: "delivery-rejected",
          reason: delivery.reason,
        });
      }
    } catch {
      this.#dependencies.logger.warn({
        event: UserReportLogEvent.OPERATOR_NOTIFY_FAILED,
        reportId: report.id,
        errorType: "delivery-error",
      });
    }
  }
}
