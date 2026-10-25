import { Logger, type FactoryProvider } from "@nestjs/common";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import {
  AI_PROVIDER,
  AI_TASK_SETTINGS,
  type AiTaskSettingsMap,
  USER_LOCALE_PREFERENCE_READER,
} from "#api/modules/ai-assistance/ai-assistance-parsing.public";
import { USER_MUTATION_LOCK } from "#api/modules/identity/identity-user-access.public";
import { UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { AI_REPORT_REPOSITORY } from "./application/ports/reports/ai-report.repository.port.js";
import { TODO_STATS_READER } from "./application/ports/reports/todo-stats.reader.port.js";
import { GenerateReport } from "./application/use-cases/reports/generate-report.use-case.js";
import { GetReportById } from "./application/use-cases/reports/get-report-by-id.use-case.js";
import { GetReportStatus } from "./application/use-cases/reports/get-report-status.use-case.js";
import { GetReports } from "./application/use-cases/reports/get-reports.use-case.js";

export const generateReportProvider: FactoryProvider<GenerateReport> = {
  provide: GenerateReport,
  inject: [
    AI_REPORT_REPOSITORY,
    TODO_STATS_READER,
    AI_PROVIDER,
    ENTITLEMENT_READER,
    USER_MUTATION_LOCK,
    UNIT_OF_WORK,
    AI_TASK_SETTINGS,
  ],
  useFactory: (
    aiReportRepository: ConstructorParameters<typeof GenerateReport>[0]["aiReportRepository"],
    todoStatsReader: ConstructorParameters<typeof GenerateReport>[0]["todoStatsReader"],
    aiProvider: ConstructorParameters<typeof GenerateReport>[0]["aiProvider"],
    entitlementReader: ConstructorParameters<typeof GenerateReport>[0]["entitlementReader"],
    userMutationLock: ConstructorParameters<typeof GenerateReport>[0]["userMutationLock"],
    unitOfWork: ConstructorParameters<typeof GenerateReport>[0]["unitOfWork"],
    settings: AiTaskSettingsMap,
  ) =>
    new GenerateReport({
      aiReportRepository,
      todoStatsReader,
      aiProvider,
      entitlementReader,
      userMutationLock,
      unitOfWork,
      settings: settings.report,
      logger: new Logger(GenerateReport.name),
    }),
};

export const getReportByIdProvider: FactoryProvider<GetReportById> = {
  provide: GetReportById,
  inject: [AI_REPORT_REPOSITORY, ENTITLEMENT_READER],
  useFactory: (
    aiReportRepository: ConstructorParameters<typeof GetReportById>[0]["aiReportRepository"],
    entitlementReader: ConstructorParameters<typeof GetReportById>[0]["entitlementReader"],
  ) =>
    new GetReportById({
      aiReportRepository,
      entitlementReader,
    }),
};

export const getReportStatusProvider: FactoryProvider<GetReportStatus> = {
  provide: GetReportStatus,
  inject: [AI_REPORT_REPOSITORY, ENTITLEMENT_READER, USER_LOCALE_PREFERENCE_READER],
  useFactory: (
    aiReportRepository: ConstructorParameters<typeof GetReportStatus>[0]["aiReportRepository"],
    entitlementReader: ConstructorParameters<typeof GetReportStatus>[0]["entitlementReader"],
    localePreferenceReader: ConstructorParameters<
      typeof GetReportStatus
    >[0]["localePreferenceReader"],
  ) =>
    new GetReportStatus({
      aiReportRepository,
      entitlementReader,
      localePreferenceReader,
    }),
};

export const getReportsProvider: FactoryProvider<GetReports> = {
  provide: GetReports,
  inject: [AI_REPORT_REPOSITORY, ENTITLEMENT_READER],
  useFactory: (
    aiReportRepository: ConstructorParameters<typeof GetReports>[0]["aiReportRepository"],
    entitlementReader: ConstructorParameters<typeof GetReports>[0]["entitlementReader"],
  ) =>
    new GetReports({
      aiReportRepository,
      entitlementReader,
    }),
};
