import { Logger, type FactoryProvider } from "@nestjs/common";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import { USER_MUTATION_LOCK } from "#api/modules/identity/identity-user-access.public";
import { UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { AI_GENERATOR } from "../generation/ai-assistance-generation.public.js";
import {
  AI_CLIENT_APP_VERSION_READER,
  AI_DATA_SHARING_CONSENT_DECISION_READER,
  USER_LOCALE_PREFERENCE_READER,
} from "../parsing/ai-assistance-parsing.public.js";
import { AI_REPORT_REPOSITORY } from "./application/ports/ai-report.repository.port.js";
import { TODO_STATS_READER } from "./application/ports/todo-stats.reader.port.js";
import { GenerateReport } from "./application/use-cases/generate-report.use-case.js";
import { GetReportById } from "./application/use-cases/get-report-by-id.use-case.js";
import { GetReportStatus } from "./application/use-cases/get-report-status.use-case.js";
import { GetReports } from "./application/use-cases/get-reports.use-case.js";

export const generateReportProvider: FactoryProvider<GenerateReport> = {
  provide: GenerateReport,
  inject: [
    AI_REPORT_REPOSITORY,
    TODO_STATS_READER,
    AI_GENERATOR,
    AI_DATA_SHARING_CONSENT_DECISION_READER,
    AI_CLIENT_APP_VERSION_READER,
    ENTITLEMENT_READER,
    USER_MUTATION_LOCK,
    UNIT_OF_WORK,
  ],
  useFactory: (
    aiReportRepository: ConstructorParameters<typeof GenerateReport>[0]["aiReportRepository"],
    todoStatsReader: ConstructorParameters<typeof GenerateReport>[0]["todoStatsReader"],
    generator: ConstructorParameters<typeof GenerateReport>[0]["generator"],
    aiDataSharingConsent: ConstructorParameters<typeof GenerateReport>[0]["aiDataSharingConsent"],
    clientAppVersion: ConstructorParameters<typeof GenerateReport>[0]["clientAppVersion"],
    entitlementReader: ConstructorParameters<typeof GenerateReport>[0]["entitlementReader"],
    userMutationLock: ConstructorParameters<typeof GenerateReport>[0]["userMutationLock"],
    unitOfWork: ConstructorParameters<typeof GenerateReport>[0]["unitOfWork"],
  ) =>
    new GenerateReport({
      aiReportRepository,
      todoStatsReader,
      generator,
      aiDataSharingConsent,
      clientAppVersion,
      entitlementReader,
      userMutationLock,
      unitOfWork,
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
