import type { Provider } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";

import { EntitlementReaderPort } from "#api/modules/access/feature-grants/access-feature-grants.public";
import { UserTimezoneReaderPort } from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import { UserMutationLockPort } from "#api/modules/identity/users/identity-users.public";
import {
  RepeatingTodoTitleReaderPort,
  SingleTodoCountReaderPort,
} from "#api/modules/planning/todos/planning-todos-queries.public";
import { StagedTodoCreatorPort } from "#api/modules/planning/todos/planning-todos.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { AiGeneratorPort } from "../ai-generations/application/ports/ai-generator.port.js";
import { UserLocalePreferenceReaderPort } from "../ai-generations/application/ports/user-locale-preference.reader.port.js";
import { CheckScheduledAiConsentUseCase } from "../ai-generations/application/use-cases/check-scheduled-ai-consent.use-case.js";
import { aiAssistanceSuggestionsConfig } from "./ai-assistance-suggestions.config.js";
import { OnDemandSuggestionAnalysisConfigPort } from "./application/ports/on-demand-suggestion-analysis-config.port.js";
import { SuggestionActivityReaderPort } from "./application/ports/suggestion-activity.reader.port.js";
import { SuggestionAnalysisEnqueuerPort } from "./application/ports/suggestion-analysis-enqueuer.port.js";
import { SuggestionAnalysisRunRepositoryPort } from "./application/ports/suggestion-analysis-run.repository.port.js";
import { SuggestionRepositoryPort } from "./application/ports/suggestion.repository.port.js";
import { AnalyzeAndCreateSuggestionsUseCase } from "./application/use-cases/analyze-and-create-suggestions.use-case.js";
import { CountRecentSuggestionTodosUseCase } from "./application/use-cases/count-recent-suggestion-todos.use-case.js";
import { DispatchSuggestionAnalysesUseCase } from "./application/use-cases/dispatch-suggestion-analyses.use-case.js";
import { GetSuggestionAnalysisStateUseCase } from "./application/use-cases/get-suggestion-analysis-state.use-case.js";
import { GetSuggestionContextUseCase } from "./application/use-cases/get-suggestion-context.use-case.js";
import { HandleSuggestionActionUseCase } from "./application/use-cases/handle-suggestion-action.use-case.js";
import { ListPendingSuggestionsUseCase } from "./application/use-cases/list-pending-suggestions.use-case.js";
import { RequestSuggestionAnalysisUseCase } from "./application/use-cases/request-suggestion-analysis.use-case.js";
import { SuggestionAnalysisQueueAdapter } from "./infrastructure/jobs/suggestion-analysis-queue.adapter.js";
import { SuggestionAnalysisProcessor } from "./infrastructure/jobs/suggestion-analysis.processor.js";
import { SuggestionAnalysisScheduler } from "./infrastructure/jobs/suggestion-analysis.scheduler.js";
import { DrizzleSuggestionActivityReader } from "./infrastructure/persistence/drizzle-suggestion-activity.reader.js";
import { DrizzleSuggestionAnalysisRunRepository } from "./infrastructure/persistence/drizzle-suggestion-analysis-run.repository.js";
import { DrizzleSuggestionRepository } from "./infrastructure/persistence/drizzle-suggestion.repository.js";

export const AI_ASSISTANCE_SUGGESTIONS_PROVIDERS = [
  { provide: SuggestionRepositoryPort, useClass: DrizzleSuggestionRepository },
  { provide: SuggestionActivityReaderPort, useClass: DrizzleSuggestionActivityReader },
  {
    provide: SuggestionAnalysisRunRepositoryPort,
    useClass: DrizzleSuggestionAnalysisRunRepository,
  },
  { provide: SuggestionAnalysisEnqueuerPort, useClass: SuggestionAnalysisQueueAdapter },
  {
    provide: OnDemandSuggestionAnalysisConfigPort,
    inject: [aiAssistanceSuggestionsConfig.KEY],
    useFactory: (
      config: ConfigType<typeof aiAssistanceSuggestionsConfig>,
    ): OnDemandSuggestionAnalysisConfigPort => ({ isEnabled: config.onDemandEnabled }),
  },
  provideUseCase(GetSuggestionContextUseCase, {
    activityReader: SuggestionActivityReaderPort,
    repeatingTitleReader: RepeatingTodoTitleReaderPort,
    clock: ClockPort,
  }),
  provideUseCase(CountRecentSuggestionTodosUseCase, {
    todoCountReader: SingleTodoCountReaderPort,
    timezoneReader: UserTimezoneReaderPort,
  }),
  provideUseCase(GetSuggestionAnalysisStateUseCase, {
    runs: SuggestionAnalysisRunRepositoryPort,
    countRecentTodos: CountRecentSuggestionTodosUseCase,
    scheduledAiConsent: CheckScheduledAiConsentUseCase,
    onDemandConfig: OnDemandSuggestionAnalysisConfigPort,
    clock: ClockPort,
  }),
  provideUseCase(RequestSuggestionAnalysisUseCase, {
    entitlementReader: EntitlementReaderPort,
    onDemandConfig: OnDemandSuggestionAnalysisConfigPort,
    runs: SuggestionAnalysisRunRepositoryPort,
    suggestions: SuggestionRepositoryPort,
    enqueuer: SuggestionAnalysisEnqueuerPort,
    analysisState: GetSuggestionAnalysisStateUseCase,
    countRecentTodos: CountRecentSuggestionTodosUseCase,
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    clock: ClockPort,
    logger: loggerFor(RequestSuggestionAnalysisUseCase),
  }),
  provideUseCase(DispatchSuggestionAnalysesUseCase, {
    runs: SuggestionAnalysisRunRepositoryPort,
    enqueuer: SuggestionAnalysisEnqueuerPort,
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    clock: ClockPort,
  }),
  provideUseCase(AnalyzeAndCreateSuggestionsUseCase, {
    repository: SuggestionRepositoryPort,
    runs: SuggestionAnalysisRunRepositoryPort,
    generator: AiGeneratorPort,
    scheduledAiConsent: CheckScheduledAiConsentUseCase,
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    suggestionContext: GetSuggestionContextUseCase,
    entitlementReader: EntitlementReaderPort,
    userMutationLock: UserMutationLockPort,
    clock: ClockPort,
    logger: loggerFor(AnalyzeAndCreateSuggestionsUseCase),
  }),
  provideUseCase(ListPendingSuggestionsUseCase, {
    repository: SuggestionRepositoryPort,
    analysisState: GetSuggestionAnalysisStateUseCase,
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
