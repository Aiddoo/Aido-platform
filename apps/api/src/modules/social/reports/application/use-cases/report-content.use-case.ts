import type { UserReportReason, UserReportTargetType } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  dailyReportWindowStart,
  duplicateReportWindowStart,
  hasReachedDailyReportLimit,
} from "../../domain/user-report-submission.domain-service.js";
import { UserReportTarget } from "../../domain/user-report-target.vo.js";
import { UserReport } from "../../domain/user-report.aggregate.js";
import type { UserReportNotifierPort } from "../ports/user-report-notifier.port.js";
import type { UserReportRepositoryPort } from "../ports/user-report.repository.port.js";
import { toUserReportSubmission } from "../read-models/user-report-submission.read-model.js";
import { dailyReportLimitReached, reportTargetUserNotFound } from "../reports.errors.js";
import { UserReportLockKeys } from "../reports.lock-keys.js";
import { UserReportLogEvent } from "../reports.log-events.js";

export interface ReportContentCommand {
  readonly reporterId: string;
  readonly targetUserId: string;
  readonly targetType: UserReportTargetType;
  readonly targetId?: string;
  readonly reason: UserReportReason;
  readonly detail?: string;
}

export interface ReportContentDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly userReportRepository: Pick<
    UserReportRepositoryPort,
    | "nextId"
    | "existsActiveUser"
    | "findRecentByTarget"
    | "countByReporterSince"
    | "save"
    | "findUserTags"
  >;
  readonly notifier: Pick<UserReportNotifierPort, "notifyOperators">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn">;
}

interface Submission {
  readonly report: UserReport;
  readonly isDuplicate: boolean;
}

// 같은 대상을 24시간 안에 다시 신고하면 기존 접수를 돌려줘 운영자 알림이 쌓이지 않게 한다.
// 알림은 커밋 뒤에 보내고, 실패해도 저장한 신고는 남겨 운영자가 DB에서 확인할 수 있게 한다
export class ReportContentUseCase {
  readonly #dependencies: ReportContentDependencies;

  constructor(dependencies: ReportContentDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: ReportContentCommand): Promise<UserReport> {
    const { unitOfWork, userReportRepository, clock, logger } = this.#dependencies;
    // 대상 형식을 자기 신고보다 먼저 거부한다(출시 앱이 받는 오류 우선순위)
    const target = UserReportTarget.create({
      type: command.targetType,
      contentId: command.targetId ?? null,
    });
    const created = UserReport.create({
      id: await userReportRepository.nextId(),
      reporterId: UserId.reconstitute(command.reporterId),
      targetUserId: UserId.reconstitute(command.targetUserId),
      target,
      reason: command.reason,
      detail: command.detail,
      now: clock.now(),
    });

    const { report, isDuplicate } = await unitOfWork.run(() => this.#submit(created));

    if (isDuplicate) {
      logger.log({
        event: UserReportLogEvent.DUPLICATE_IGNORED,
        userId: command.reporterId,
        reportId: report.id.value,
      });
      return report;
    }

    logger.log({
      event: UserReportLogEvent.SUBMITTED,
      userId: command.reporterId,
      targetUserId: command.targetUserId,
      reportId: report.id.value,
      targetType: command.targetType,
      reason: command.reason,
    });
    await this.#notifyOperators(report);
    return report;
  }

  async #submit(report: UserReport): Promise<Submission> {
    const { mutationLock, userReportRepository } = this.#dependencies;
    // 같은 신고자의 연속 요청을 직렬화해 중복 판정과 하루 한도가 동시에 새지 않게 한다
    await mutationLock.acquire([UserReportLockKeys.reporter(report.reporterId)]);

    if (!(await userReportRepository.existsActiveUser(report.targetUserId))) {
      throw reportTargetUserNotFound(report.targetUserId);
    }

    const duplicate = await userReportRepository.findRecentByTarget({
      reporterId: report.reporterId,
      targetUserId: report.targetUserId,
      target: report.target,
      since: duplicateReportWindowStart(report.createdAt),
    });
    if (duplicate != null) {
      return { report: duplicate, isDuplicate: true };
    }

    const recentCount = await userReportRepository.countByReporterSince(
      report.reporterId,
      dailyReportWindowStart(report.createdAt),
    );
    if (hasReachedDailyReportLimit(recentCount)) {
      throw dailyReportLimitReached(recentCount);
    }

    await userReportRepository.save(report);
    return { report, isDuplicate: false };
  }

  async #notifyOperators(report: UserReport): Promise<void> {
    const { userReportRepository, notifier, logger } = this.#dependencies;
    try {
      const userTags = await userReportRepository.findUserTags([
        report.reporterId,
        report.targetUserId,
      ]);
      const delivery = await notifier.notifyOperators(toUserReportSubmission(report, userTags));
      if (delivery.status === "rejected") {
        logger.warn({
          event: UserReportLogEvent.OPERATOR_NOTIFY_FAILED,
          reportId: report.id.value,
          errorType: "delivery-rejected",
          reason: delivery.reason,
        });
      }
    } catch {
      logger.warn({
        event: UserReportLogEvent.OPERATOR_NOTIFY_FAILED,
        reportId: report.id.value,
        errorType: "delivery-error",
      });
    }
  }
}
