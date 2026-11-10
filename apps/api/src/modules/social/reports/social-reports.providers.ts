import { Logger, type FactoryProvider } from "@nestjs/common";

import { MUTATION_LOCK, UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { USER_REPORT_NOTIFIER } from "./application/ports/user-report-notifier.port.js";
import { USER_REPORT_REPOSITORY } from "./application/ports/user-report.repository.port.js";
import { ReportContentUseCase } from "./application/use-cases/report-content.use-case.js";
import { ResolveUserReportUseCase } from "./application/use-cases/resolve-user-report.use-case.js";

export const reportContentProvider: FactoryProvider<ReportContentUseCase> = {
  provide: ReportContentUseCase,
  inject: [USER_REPORT_REPOSITORY, USER_REPORT_NOTIFIER, UNIT_OF_WORK, MUTATION_LOCK],
  useFactory: (
    userReportRepository: ConstructorParameters<
      typeof ReportContentUseCase
    >[0]["userReportRepository"],
    notifier: ConstructorParameters<typeof ReportContentUseCase>[0]["notifier"],
    unitOfWork: ConstructorParameters<typeof ReportContentUseCase>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof ReportContentUseCase>[0]["mutationLock"],
  ) =>
    new ReportContentUseCase({
      userReportRepository,
      notifier,
      unitOfWork,
      mutationLock,
      logger: new Logger(ReportContentUseCase.name),
    }),
};

export const resolveUserReportProvider: FactoryProvider<ResolveUserReportUseCase> = {
  provide: ResolveUserReportUseCase,
  inject: [USER_REPORT_REPOSITORY, UNIT_OF_WORK],
  useFactory: (
    userReportRepository: ConstructorParameters<
      typeof ResolveUserReportUseCase
    >[0]["userReportRepository"],
    unitOfWork: ConstructorParameters<typeof ResolveUserReportUseCase>[0]["unitOfWork"],
  ) => new ResolveUserReportUseCase({ userReportRepository, unitOfWork }),
};
