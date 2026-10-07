import { Logger, type FactoryProvider } from "@nestjs/common";

import { EntitlementService } from "#api/modules/access/application/services/entitlement/entitlement.service";
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
  inject: [AI_REPORT_REPOSITORY, EntitlementService],
  useFactory: (
    aiReportRepository: ConstructorParameters<typeof GetReportById>[0]["aiReportRepository"],
    entitlementService: ConstructorParameters<typeof GetReportById>[0]["entitlementService"],
  ) =>
    new GetReportById({
      aiReportRepository,
      entitlementService,
    }),
};

export const getReportStatusProvider: FactoryProvider<GetReportStatus> = {
  provide: GetReportStatus,
  inject: [AI_REPORT_REPOSITORY, EntitlementService],
  useFactory: (
    aiReportRepository: ConstructorParameters<typeof GetReportStatus>[0]["aiReportRepository"],
    entitlementService: ConstructorParameters<typeof GetReportStatus>[0]["entitlementService"],
  ) =>
    new GetReportStatus({
      aiReportRepository,
      entitlementService,
    }),
};

export const getReportsProvider: FactoryProvider<GetReports> = {
  provide: GetReports,
  inject: [AI_REPORT_REPOSITORY, EntitlementService],
  useFactory: (
    aiReportRepository: ConstructorParameters<typeof GetReports>[0]["aiReportRepository"],
    entitlementService: ConstructorParameters<typeof GetReports>[0]["entitlementService"],
  ) =>
    new GetReports({
      aiReportRepository,
      entitlementService,
    }),
};
