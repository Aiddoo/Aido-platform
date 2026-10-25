import { Logger, type FactoryProvider } from "@nestjs/common";

import { MUTATION_LOCK, UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { USER_REPORT_NOTIFIER } from "./application/ports/reports/user-report-notifier.port.js";
import { USER_REPORT_REPOSITORY } from "./application/ports/reports/user-report.repository.port.js";
import { ReportContent } from "./application/use-cases/reports/report-content.use-case.js";
import { ResolveUserReport } from "./application/use-cases/reports/resolve-user-report.use-case.js";

export const reportContentProvider: FactoryProvider<ReportContent> = {
  provide: ReportContent,
  inject: [USER_REPORT_REPOSITORY, USER_REPORT_NOTIFIER, UNIT_OF_WORK, MUTATION_LOCK],
  useFactory: (
    userReportRepository: ConstructorParameters<typeof ReportContent>[0]["userReportRepository"],
    notifier: ConstructorParameters<typeof ReportContent>[0]["notifier"],
    unitOfWork: ConstructorParameters<typeof ReportContent>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof ReportContent>[0]["mutationLock"],
  ) =>
    new ReportContent({
      userReportRepository,
      notifier,
      unitOfWork,
      mutationLock,
      logger: new Logger(ReportContent.name),
    }),
};

export const resolveUserReportProvider: FactoryProvider<ResolveUserReport> = {
  provide: ResolveUserReport,
  inject: [USER_REPORT_REPOSITORY, UNIT_OF_WORK],
  useFactory: (
    userReportRepository: ConstructorParameters<
      typeof ResolveUserReport
    >[0]["userReportRepository"],
    unitOfWork: ConstructorParameters<typeof ResolveUserReport>[0]["unitOfWork"],
  ) => new ResolveUserReport({ userReportRepository, unitOfWork }),
};
