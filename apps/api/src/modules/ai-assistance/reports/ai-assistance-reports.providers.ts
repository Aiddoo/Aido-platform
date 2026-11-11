import type { Provider } from "@nestjs/common";

import { EntitlementReaderPort } from "#api/modules/access/entitlements/access-entitlements.public";
import { UserMutationLockPort } from "#api/modules/identity/users/identity-users.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
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

export const AI_ASSISTANCE_REPORTS_PROVIDERS = [
  { provide: AiReportRepositoryPort, useClass: DrizzleAiReportRepository },
  { provide: TodoStatsReaderPort, useClass: DrizzleTodoStatsReader },
  { provide: LatestReportStatsReaderPort, useClass: LatestReportStatsReaderAdapter },
  provideUseCase(GenerateReportUseCase, {
    aiReportRepository: AiReportRepositoryPort,
    todoStatsReader: TodoStatsReaderPort,
    generator: AiGeneratorPort,
    scheduledAiConsent: ScheduledAiConsentReader,
    entitlementReader: EntitlementReaderPort,
    userMutationLock: UserMutationLockPort,
    unitOfWork: UnitOfWorkPort,
    clock: ClockPort,
    logger: loggerFor(GenerateReportUseCase),
  }),
  provideUseCase(GetReportByIdUseCase, {
    aiReportRepository: AiReportRepositoryPort,
    entitlementReader: EntitlementReaderPort,
  }),
  provideUseCase(ListReportsUseCase, {
    aiReportRepository: AiReportRepositoryPort,
    entitlementReader: EntitlementReaderPort,
  }),
  provideUseCase(GetReportStatusUseCase, {
    aiReportRepository: AiReportRepositoryPort,
    entitlementReader: EntitlementReaderPort,
    localePreferenceReader: UserLocalePreferenceReaderPort,
    clock: ClockPort,
  }),
  ReportGenerationScheduler,
  ReportGenerationProcessor,
] satisfies Provider[];
