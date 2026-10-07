import { Logger, type FactoryProvider } from "@nestjs/common";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import { AI_PROVIDER } from "#api/modules/ai-assistance/ai-assistance-parsing.public";

import { AI_REPORT_REPOSITORY } from "./application/ports/reports/ai-report.repository.port.js";
import { TODO_STATS_READER } from "./application/ports/reports/todo-stats.reader.port.js";
import { GenerateReport } from "./application/use-cases/reports/generate-report.use-case.js";
import { GetReportById } from "./application/use-cases/reports/get-report-by-id.use-case.js";
import { GetReportStatus } from "./application/use-cases/reports/get-report-status.use-case.js";
import { GetReports } from "./application/use-cases/reports/get-reports.use-case.js";

export const generateReportProvider: FactoryProvider<GenerateReport> = {
  provide: GenerateReport,
  inject: [AI_REPORT_REPOSITORY, TODO_STATS_READER, AI_PROVIDER],
  useFactory: (
    aiReportRepository: ConstructorParameters<typeof GenerateReport>[0]["aiReportRepository"],
    todoStatsReader: ConstructorParameters<typeof GenerateReport>[0]["todoStatsReader"],
    aiProvider: ConstructorParameters<typeof GenerateReport>[0]["aiProvider"],
  ) =>
    new GenerateReport({
      aiReportRepository,
      todoStatsReader,
      aiProvider,
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
  inject: [AI_REPORT_REPOSITORY, ENTITLEMENT_READER],
  useFactory: (
    aiReportRepository: ConstructorParameters<typeof GetReportStatus>[0]["aiReportRepository"],
    entitlementReader: ConstructorParameters<typeof GetReportStatus>[0]["entitlementReader"],
  ) =>
    new GetReportStatus({
      aiReportRepository,
      entitlementReader,
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
