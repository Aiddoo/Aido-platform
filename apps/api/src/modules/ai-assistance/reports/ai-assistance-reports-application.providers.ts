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
import { GenerateReportUseCase } from "./application/use-cases/generate-report.use-case.js";
import { GetReportByIdUseCase } from "./application/use-cases/get-report-by-id.use-case.js";
import { GetReportStatusUseCase } from "./application/use-cases/get-report-status.use-case.js";
import { ListReportsUseCase } from "./application/use-cases/list-reports.use-case.js";

export const generateReportProvider: FactoryProvider<GenerateReportUseCase> = {
  provide: GenerateReportUseCase,
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
    aiReportRepository: ConstructorParameters<
      typeof GenerateReportUseCase
    >[0]["aiReportRepository"],
    todoStatsReader: ConstructorParameters<typeof GenerateReportUseCase>[0]["todoStatsReader"],
    generator: ConstructorParameters<typeof GenerateReportUseCase>[0]["generator"],
    aiDataSharingConsent: ConstructorParameters<
      typeof GenerateReportUseCase
    >[0]["aiDataSharingConsent"],
    clientAppVersion: ConstructorParameters<typeof GenerateReportUseCase>[0]["clientAppVersion"],
    entitlementReader: ConstructorParameters<typeof GenerateReportUseCase>[0]["entitlementReader"],
    userMutationLock: ConstructorParameters<typeof GenerateReportUseCase>[0]["userMutationLock"],
    unitOfWork: ConstructorParameters<typeof GenerateReportUseCase>[0]["unitOfWork"],
  ) =>
    new GenerateReportUseCase({
      aiReportRepository,
      todoStatsReader,
      generator,
      aiDataSharingConsent,
      clientAppVersion,
      entitlementReader,
      userMutationLock,
      unitOfWork,
      logger: new Logger(GenerateReportUseCase.name),
    }),
};

export const getReportByIdProvider: FactoryProvider<GetReportByIdUseCase> = {
  provide: GetReportByIdUseCase,
  inject: [AI_REPORT_REPOSITORY, ENTITLEMENT_READER],
  useFactory: (
    aiReportRepository: ConstructorParameters<typeof GetReportByIdUseCase>[0]["aiReportRepository"],
    entitlementReader: ConstructorParameters<typeof GetReportByIdUseCase>[0]["entitlementReader"],
  ) =>
    new GetReportByIdUseCase({
      aiReportRepository,
      entitlementReader,
    }),
};

export const getReportStatusProvider: FactoryProvider<GetReportStatusUseCase> = {
  provide: GetReportStatusUseCase,
  inject: [AI_REPORT_REPOSITORY, ENTITLEMENT_READER, USER_LOCALE_PREFERENCE_READER],
  useFactory: (
    aiReportRepository: ConstructorParameters<
      typeof GetReportStatusUseCase
    >[0]["aiReportRepository"],
    entitlementReader: ConstructorParameters<typeof GetReportStatusUseCase>[0]["entitlementReader"],
    localePreferenceReader: ConstructorParameters<
      typeof GetReportStatusUseCase
    >[0]["localePreferenceReader"],
  ) =>
    new GetReportStatusUseCase({
      aiReportRepository,
      entitlementReader,
      localePreferenceReader,
    }),
};

export const listReportsProvider: FactoryProvider<ListReportsUseCase> = {
  provide: ListReportsUseCase,
  inject: [AI_REPORT_REPOSITORY, ENTITLEMENT_READER],
  useFactory: (
    aiReportRepository: ConstructorParameters<typeof ListReportsUseCase>[0]["aiReportRepository"],
    entitlementReader: ConstructorParameters<typeof ListReportsUseCase>[0]["entitlementReader"],
  ) =>
    new ListReportsUseCase({
      aiReportRepository,
      entitlementReader,
    }),
};
