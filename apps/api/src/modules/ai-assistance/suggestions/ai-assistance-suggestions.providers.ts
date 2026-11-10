import { type FactoryProvider, Logger, type Provider } from "@nestjs/common";

import {
  ENTITLEMENT_READER,
  type EntitlementReaderPort,
} from "#api/modules/access/access-entitlement.public";
import { UserMutationLockPort } from "#api/modules/identity/identity-user-access.public";
import { StagedTodoCreatorPort } from "#api/modules/planning/todos/planning-todos.public";
import { WeatherForecastReaderPort } from "#api/modules/weather/forecasts/weather-forecasts.public";
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

// access 권한은 아직 Symbol 토큰이라 provideUseCase 대신 inject 목록으로 조립한다
const suggestionContextReaderProvider: FactoryProvider<SuggestionContextReader> = {
  provide: SuggestionContextReader,
  inject: [
    SuggestionActivityReaderPort,
    WeatherForecastReaderPort,
    LatestReportStatsReaderPort,
    ClockPort,
  ],
  useFactory: (
    activityReader: SuggestionActivityReaderPort,
    weatherForecastReader: WeatherForecastReaderPort,
    latestReportStats: LatestReportStatsReaderPort,
    clock: ClockPort,
  ) =>
    new SuggestionContextReader({
      activityReader,
      weatherForecastReader,
      latestReportStats,
      clock,
      logger: new Logger(SuggestionContextReader.name),
    }),
};

const analyzeAndCreateSuggestionsProvider: FactoryProvider<AnalyzeAndCreateSuggestionsUseCase> = {
  provide: AnalyzeAndCreateSuggestionsUseCase,
  inject: [
    SuggestionRepositoryPort,
    AiGeneratorPort,
    ScheduledAiConsentReader,
    UnitOfWorkPort,
    SuggestionContextReader,
    ENTITLEMENT_READER,
    UserMutationLockPort,
    ClockPort,
  ],
  useFactory: (
    repository: SuggestionRepositoryPort,
    generator: AiGeneratorPort,
    scheduledAiConsent: ScheduledAiConsentReader,
    unitOfWork: UnitOfWorkPort,
    contextBuilder: SuggestionContextReader,
    entitlementReader: EntitlementReaderPort,
    userMutationLock: UserMutationLockPort,
    clock: ClockPort,
  ) =>
    new AnalyzeAndCreateSuggestionsUseCase({
      repository,
      generator,
      scheduledAiConsent,
      unitOfWork,
      contextBuilder,
      entitlementReader,
      userMutationLock,
      clock,
      logger: new Logger(AnalyzeAndCreateSuggestionsUseCase.name),
    }),
};

const listPendingSuggestionsProvider: FactoryProvider<ListPendingSuggestionsUseCase> = {
  provide: ListPendingSuggestionsUseCase,
  inject: [SuggestionRepositoryPort, ENTITLEMENT_READER, ClockPort],
  useFactory: (
    repository: SuggestionRepositoryPort,
    entitlementReader: EntitlementReaderPort,
    clock: ClockPort,
  ) =>
    new ListPendingSuggestionsUseCase({
      repository,
      entitlementReader,
      clock,
      logger: new Logger(ListPendingSuggestionsUseCase.name),
    }),
};

const handleSuggestionActionProvider: FactoryProvider<HandleSuggestionActionUseCase> = {
  provide: HandleSuggestionActionUseCase,
  inject: [
    SuggestionRepositoryPort,
    StagedTodoCreatorPort,
    ENTITLEMENT_READER,
    UnitOfWorkPort,
    UserMutationLockPort,
    MutationLockPort,
    AfterCommitTaskRegistryPort,
    UserLocalePreferenceReaderPort,
    ClockPort,
  ],
  useFactory: (
    repository: SuggestionRepositoryPort,
    todoCreator: StagedTodoCreatorPort,
    entitlementReader: EntitlementReaderPort,
    unitOfWork: UnitOfWorkPort,
    userMutationLock: UserMutationLockPort,
    mutationLock: MutationLockPort,
    afterCommit: AfterCommitTaskRegistryPort,
    localePreferenceReader: UserLocalePreferenceReaderPort,
    clock: ClockPort,
  ) =>
    new HandleSuggestionActionUseCase({
      repository,
      todoCreator,
      entitlementReader,
      unitOfWork,
      userMutationLock,
      mutationLock,
      afterCommit,
      localePreferenceReader,
      clock,
      logger: new Logger(HandleSuggestionActionUseCase.name),
    }),
};

export const AI_ASSISTANCE_SUGGESTIONS_PROVIDERS = [
  { provide: SuggestionRepositoryPort, useClass: DrizzleSuggestionRepository },
  { provide: SuggestionActivityReaderPort, useClass: DrizzleSuggestionActivityReader },
  suggestionContextReaderProvider,
  analyzeAndCreateSuggestionsProvider,
  listPendingSuggestionsProvider,
  handleSuggestionActionProvider,
  SuggestionAnalysisScheduler,
  SuggestionAnalysisProcessor,
] satisfies Provider[];
