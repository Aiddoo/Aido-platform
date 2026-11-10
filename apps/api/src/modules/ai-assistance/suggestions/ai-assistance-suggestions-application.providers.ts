import { Logger, type FactoryProvider } from "@nestjs/common";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import { USER_MUTATION_LOCK } from "#api/modules/identity/identity-user-access.public";
import {
  STAGED_TODO_CREATOR,
  type StagedTodoCreatorPort,
  toTodoResponse,
} from "#api/modules/planning/todos/planning-todos.public";
import { WEATHER_FORECAST_READER } from "#api/modules/weather/forecasts/weather-forecasts.public";
import {
  AFTER_COMMIT_TASK_REGISTRY,
  MUTATION_LOCK,
  UNIT_OF_WORK,
} from "#api/shared/application/ports/index";

import { AI_GENERATOR } from "../generation/ai-assistance-generation.public.js";
import {
  AI_CLIENT_APP_VERSION_READER,
  AI_DATA_SHARING_CONSENT_DECISION_READER,
  USER_LOCALE_PREFERENCE_READER,
} from "../parsing/ai-assistance-parsing.public.js";
import { SUGGESTION_REPOSITORY } from "./application/ports/suggestion.repository.port.js";
import { WEEKLY_REPORT_READER } from "./application/ports/weekly-report.reader.port.js";
import { SuggestionContextReader } from "./application/suggestion-context.reader.js";
import { AnalyzeAndCreateSuggestionsUseCase } from "./application/use-cases/analyze-and-create-suggestions.use-case.js";
import { HandleSuggestionActionUseCase } from "./application/use-cases/handle-suggestion-action.use-case.js";
import { ListPendingSuggestionsUseCase } from "./application/use-cases/list-pending-suggestions.use-case.js";

export const suggestionContextReaderProvider: FactoryProvider<SuggestionContextReader> = {
  provide: SuggestionContextReader,
  inject: [SUGGESTION_REPOSITORY, WEATHER_FORECAST_READER, WEEKLY_REPORT_READER],
  useFactory: (
    repository: ConstructorParameters<typeof SuggestionContextReader>[0]["repository"],
    weatherForecastReader: ConstructorParameters<
      typeof SuggestionContextReader
    >[0]["weatherForecastReader"],
    reportReader: ConstructorParameters<typeof SuggestionContextReader>[0]["reportReader"],
  ) =>
    new SuggestionContextReader({
      repository,
      weatherForecastReader,
      reportReader,
      logger: new Logger(SuggestionContextReader.name),
    }),
};

export const analyzeAndCreateSuggestionsProvider: FactoryProvider<AnalyzeAndCreateSuggestionsUseCase> =
  {
    provide: AnalyzeAndCreateSuggestionsUseCase,
    inject: [
      SUGGESTION_REPOSITORY,
      AI_GENERATOR,
      AI_DATA_SHARING_CONSENT_DECISION_READER,
      AI_CLIENT_APP_VERSION_READER,
      UNIT_OF_WORK,
      SuggestionContextReader,
      ENTITLEMENT_READER,
      USER_MUTATION_LOCK,
    ],
    useFactory: (
      repository: ConstructorParameters<typeof AnalyzeAndCreateSuggestionsUseCase>[0]["repository"],
      generator: ConstructorParameters<typeof AnalyzeAndCreateSuggestionsUseCase>[0]["generator"],
      aiDataSharingConsent: ConstructorParameters<
        typeof AnalyzeAndCreateSuggestionsUseCase
      >[0]["aiDataSharingConsent"],
      clientAppVersion: ConstructorParameters<
        typeof AnalyzeAndCreateSuggestionsUseCase
      >[0]["clientAppVersion"],
      unitOfWork: ConstructorParameters<typeof AnalyzeAndCreateSuggestionsUseCase>[0]["unitOfWork"],
      contextBuilder: ConstructorParameters<
        typeof AnalyzeAndCreateSuggestionsUseCase
      >[0]["contextBuilder"],
      entitlementReader: ConstructorParameters<
        typeof AnalyzeAndCreateSuggestionsUseCase
      >[0]["entitlementReader"],
      userMutationLock: ConstructorParameters<
        typeof AnalyzeAndCreateSuggestionsUseCase
      >[0]["userMutationLock"],
    ) =>
      new AnalyzeAndCreateSuggestionsUseCase({
        repository,
        generator,
        aiDataSharingConsent,
        clientAppVersion,
        unitOfWork,
        contextBuilder,
        entitlementReader,
        userMutationLock,
        logger: new Logger(AnalyzeAndCreateSuggestionsUseCase.name),
      }),
  };

export const listPendingSuggestionsProvider: FactoryProvider<ListPendingSuggestionsUseCase> = {
  provide: ListPendingSuggestionsUseCase,
  inject: [SUGGESTION_REPOSITORY, ENTITLEMENT_READER],
  useFactory: (
    repository: ConstructorParameters<typeof ListPendingSuggestionsUseCase>[0]["repository"],
    entitlementReader: ConstructorParameters<
      typeof ListPendingSuggestionsUseCase
    >[0]["entitlementReader"],
  ) =>
    new ListPendingSuggestionsUseCase({
      repository,
      entitlementReader,
      logger: new Logger(ListPendingSuggestionsUseCase.name),
    }),
};

export const handleSuggestionActionProvider: FactoryProvider<HandleSuggestionActionUseCase> = {
  provide: HandleSuggestionActionUseCase,
  inject: [
    SUGGESTION_REPOSITORY,
    STAGED_TODO_CREATOR,
    ENTITLEMENT_READER,
    UNIT_OF_WORK,
    USER_MUTATION_LOCK,
    MUTATION_LOCK,
    AFTER_COMMIT_TASK_REGISTRY,
    USER_LOCALE_PREFERENCE_READER,
  ],
  useFactory: (
    repository: ConstructorParameters<typeof HandleSuggestionActionUseCase>[0]["repository"],
    stagedTodoCreator: StagedTodoCreatorPort,
    entitlementReader: ConstructorParameters<
      typeof HandleSuggestionActionUseCase
    >[0]["entitlementReader"],
    unitOfWork: ConstructorParameters<typeof HandleSuggestionActionUseCase>[0]["unitOfWork"],
    userMutationLock: ConstructorParameters<
      typeof HandleSuggestionActionUseCase
    >[0]["userMutationLock"],
    mutationLock: ConstructorParameters<typeof HandleSuggestionActionUseCase>[0]["mutationLock"],
    afterCommit: ConstructorParameters<typeof HandleSuggestionActionUseCase>[0]["afterCommit"],
    localePreferenceReader: ConstructorParameters<
      typeof HandleSuggestionActionUseCase
    >[0]["localePreferenceReader"],
  ) =>
    new HandleSuggestionActionUseCase({
      repository,
      // ai는 아직 계약 Todo로 받는다. planning Read Model은 경계에서 계약 모양으로 바꾼다
      todoCreator: {
        stage: async (draft) => {
          const staged = await stagedTodoCreator.stage(draft);
          return { todos: staged.todos.map(toTodoResponse), afterCommit: staged.afterCommit };
        },
      },
      entitlementReader,
      unitOfWork,
      userMutationLock,
      mutationLock,
      afterCommit,
      localePreferenceReader,
      logger: new Logger(HandleSuggestionActionUseCase.name),
    }),
};
