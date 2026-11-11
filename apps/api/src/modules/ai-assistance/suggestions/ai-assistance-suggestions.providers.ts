import type { Provider } from "@nestjs/common";

import { EntitlementReaderPort } from "#api/modules/access/entitlements/access-entitlements.public";
import { UserMutationLockPort } from "#api/modules/identity/users/identity-users.public";
import { StagedTodoCreatorPort } from "#api/modules/planning/todos/planning-todos.public";
import { WeatherForecastReaderPort } from "#api/modules/weather/forecasts/weather-forecasts.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { AiGeneratorPort } from "../generation/application/ports/ai-generator.port.js";
import { UserLocalePreferenceReaderPort } from "../generation/application/ports/user-locale-preference.reader.port.js";
import { ScheduledAiConsentReader } from "../generation/application/scheduled-ai-consent.reader.js";
import { LatestReportStatsReaderPort } from "../reports/application/ports/latest-report-stats.reader.port.js";
import { SuggestionActivityReaderPort } from "./application/ports/suggestion-activity.reader.port.js";
import { SuggestionRepositoryPort } from "./application/ports/suggestion.repository.port.js";
import { SuggestionContextReader } from "./application/suggestion-context.reader.js";
import { AnalyzeAndCreateSuggestionsUseCase } from "./application/use-cases/analyze-and-create-suggestions.use-case.js";
import { HandleSuggestionActionUseCase } from "./application/use-cases/handle-suggestion-action.use-case.js";
import { ListPendingSuggestionsUseCase } from "./application/use-cases/list-pending-suggestions.use-case.js";
import { SuggestionAnalysisProcessor } from "./infrastructure/jobs/suggestion-analysis.processor.js";
import { SuggestionAnalysisScheduler } from "./infrastructure/jobs/suggestion-analysis.scheduler.js";
import { DrizzleSuggestionActivityReader } from "./infrastructure/persistence/drizzle-suggestion-activity.reader.js";
import { DrizzleSuggestionRepository } from "./infrastructure/persistence/drizzle-suggestion.repository.js";

export const AI_ASSISTANCE_SUGGESTIONS_PROVIDERS = [
  { provide: SuggestionRepositoryPort, useClass: DrizzleSuggestionRepository },
  { provide: SuggestionActivityReaderPort, useClass: DrizzleSuggestionActivityReader },
  provideUseCase(SuggestionContextReader, {
    activityReader: SuggestionActivityReaderPort,
    weatherForecastReader: WeatherForecastReaderPort,
    latestReportStats: LatestReportStatsReaderPort,
    clock: ClockPort,
    logger: loggerFor(SuggestionContextReader),
  }),
  provideUseCase(AnalyzeAndCreateSuggestionsUseCase, {
    repository: SuggestionRepositoryPort,
    generator: AiGeneratorPort,
    scheduledAiConsent: ScheduledAiConsentReader,
    unitOfWork: UnitOfWorkPort,
    contextBuilder: SuggestionContextReader,
    entitlementReader: EntitlementReaderPort,
    userMutationLock: UserMutationLockPort,
    clock: ClockPort,
    logger: loggerFor(AnalyzeAndCreateSuggestionsUseCase),
  }),
  provideUseCase(ListPendingSuggestionsUseCase, {
    repository: SuggestionRepositoryPort,
    entitlementReader: EntitlementReaderPort,
    clock: ClockPort,
    logger: loggerFor(ListPendingSuggestionsUseCase),
  }),
  provideUseCase(HandleSuggestionActionUseCase, {
    repository: SuggestionRepositoryPort,
    todoCreator: StagedTodoCreatorPort,
    entitlementReader: EntitlementReaderPort,
    unitOfWork: UnitOfWorkPort,
    userMutationLock: UserMutationLockPort,
    mutationLock: MutationLockPort,
    afterCommit: AfterCommitTaskRegistryPort,
    localePreferenceReader: UserLocalePreferenceReaderPort,
    clock: ClockPort,
    logger: loggerFor(HandleSuggestionActionUseCase),
  }),
  SuggestionAnalysisScheduler,
  SuggestionAnalysisProcessor,
] satisfies Provider[];
