import { type FactoryProvider, Logger, type Provider } from "@nestjs/common";

import {
  ENTITLEMENT_READER,
  type EntitlementReaderPort,
} from "#api/modules/access/access-entitlement.public";
import { UserMutationLockPort } from "#api/modules/identity/identity-user-access.public";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { AiGeneratorPort } from "../generation/application/ports/ai-generator.port.js";
import { UserLocalePreferenceReaderPort } from "../generation/application/ports/user-locale-preference.reader.port.js";
import { ScheduledAiConsentReader } from "../generation/application/scheduled-ai-consent.reader.js";
import { AiReportRepositoryPort } from "./application/ports/ai-report.repository.port.js";
import { LatestReportStatsReaderPort } from "./application/ports/latest-report-stats.reader.port.js";
import { TodoStatsReaderPort } from "./application/ports/todo-stats.reader.port.js";
import { GenerateReportUseCase } from "./application/use-cases/generate-report.use-case.js";
import { GetReportByIdUseCase } from "./application/use-cases/get-report-by-id.use-case.js";
import { GetReportStatusUseCase } from "./application/use-cases/get-report-status.use-case.js";
import { ListReportsUseCase } from "./application/use-cases/list-reports.use-case.js";
import { LatestReportStatsReaderAdapter } from "./infrastructure/adapters/latest-report-stats-reader.adapter.js";
import { ReportGenerationProcessor } from "./infrastructure/jobs/report-generation.processor.js";
import { ReportGenerationScheduler } from "./infrastructure/jobs/report-generation.scheduler.js";
import { DrizzleAiReportRepository } from "./infrastructure/persistence/drizzle-ai-report.repository.js";
import { DrizzleTodoStatsReader } from "./infrastructure/persistence/drizzle-todo-stats.reader.js";

// access 권한 조회는 아직 Symbol 토큰이라 provideUseCase 대신 inject 목록으로 조립한다
const generateReportProvider: FactoryProvider<GenerateReportUseCase> = {
  provide: GenerateReportUseCase,
  inject: [
    AiReportRepositoryPort,
    TodoStatsReaderPort,
    AiGeneratorPort,
    ScheduledAiConsentReader,
    ENTITLEMENT_READER,
    UserMutationLockPort,
    UnitOfWorkPort,
    ClockPort,
  ],
  useFactory: (
    aiReportRepository: AiReportRepositoryPort,
    todoStatsReader: TodoStatsReaderPort,
    generator: AiGeneratorPort,
    scheduledAiConsent: ScheduledAiConsentReader,
    entitlementReader: EntitlementReaderPort,
    userMutationLock: UserMutationLockPort,
    unitOfWork: UnitOfWorkPort,
    clock: ClockPort,
  ) =>
    new GenerateReportUseCase({
      aiReportRepository,
      todoStatsReader,
      generator,
      scheduledAiConsent,
      entitlementReader,
      userMutationLock,
      unitOfWork,
      clock,
      logger: new Logger(GenerateReportUseCase.name),
    }),
};

const getReportByIdProvider: FactoryProvider<GetReportByIdUseCase> = {
  provide: GetReportByIdUseCase,
  inject: [AiReportRepositoryPort, ENTITLEMENT_READER],
  useFactory: (
    aiReportRepository: AiReportRepositoryPort,
    entitlementReader: EntitlementReaderPort,
  ) => new GetReportByIdUseCase({ aiReportRepository, entitlementReader }),
};

const listReportsProvider: FactoryProvider<ListReportsUseCase> = {
  provide: ListReportsUseCase,
  inject: [AiReportRepositoryPort, ENTITLEMENT_READER],
  useFactory: (
    aiReportRepository: AiReportRepositoryPort,
    entitlementReader: EntitlementReaderPort,
  ) => new ListReportsUseCase({ aiReportRepository, entitlementReader }),
};

const getReportStatusProvider: FactoryProvider<GetReportStatusUseCase> = {
  provide: GetReportStatusUseCase,
  inject: [AiReportRepositoryPort, ENTITLEMENT_READER, UserLocalePreferenceReaderPort, ClockPort],
  useFactory: (
    aiReportRepository: AiReportRepositoryPort,
    entitlementReader: EntitlementReaderPort,
    localePreferenceReader: UserLocalePreferenceReaderPort,
    clock: ClockPort,
  ) =>
    new GetReportStatusUseCase({
      aiReportRepository,
      entitlementReader,
      localePreferenceReader,
      clock,
    }),
};

export const AI_ASSISTANCE_REPORTS_PROVIDERS = [
  { provide: AiReportRepositoryPort, useClass: DrizzleAiReportRepository },
  { provide: TodoStatsReaderPort, useClass: DrizzleTodoStatsReader },
  { provide: LatestReportStatsReaderPort, useClass: LatestReportStatsReaderAdapter },
  generateReportProvider,
  getReportByIdProvider,
  listReportsProvider,
  getReportStatusProvider,
  ReportGenerationScheduler,
  ReportGenerationProcessor,
] satisfies Provider[];
