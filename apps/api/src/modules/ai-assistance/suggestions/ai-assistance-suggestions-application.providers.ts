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
import { AI_SUGGESTION_REPOSITORY } from "./application/ports/suggestion.repository.port.js";
import { WEEKLY_REPORT_READER } from "./application/ports/weekly-report.reader.port.js";
import { SuggestionContextBuilder } from "./application/suggestion-context.reader.js";
import { AnalyzeAndCreateSuggestions } from "./application/use-cases/analyze-and-create-suggestions.use-case.js";
import { GetPendingSuggestions } from "./application/use-cases/get-pending-suggestions.use-case.js";
import { HandleSuggestionAction } from "./application/use-cases/handle-suggestion-action.use-case.js";

export const suggestionContextBuilderProvider: FactoryProvider<SuggestionContextBuilder> = {
  provide: SuggestionContextBuilder,
  inject: [AI_SUGGESTION_REPOSITORY, WEATHER_FORECAST_READER, WEEKLY_REPORT_READER],
  useFactory: (
    repository: ConstructorParameters<typeof SuggestionContextBuilder>[0]["repository"],
    weatherForecastReader: ConstructorParameters<
      typeof SuggestionContextBuilder
    >[0]["weatherForecastReader"],
    reportReader: ConstructorParameters<typeof SuggestionContextBuilder>[0]["reportReader"],
  ) =>
    new SuggestionContextBuilder({
      repository,
      weatherForecastReader,
      reportReader,
      logger: new Logger(SuggestionContextBuilder.name),
    }),
};

export const analyzeAndCreateSuggestionsProvider: FactoryProvider<AnalyzeAndCreateSuggestions> = {
  provide: AnalyzeAndCreateSuggestions,
  inject: [
    AI_SUGGESTION_REPOSITORY,
    AI_GENERATOR,
    AI_DATA_SHARING_CONSENT_DECISION_READER,
    AI_CLIENT_APP_VERSION_READER,
    UNIT_OF_WORK,
    SuggestionContextBuilder,
    ENTITLEMENT_READER,
    USER_MUTATION_LOCK,
  ],
  useFactory: (
    repository: ConstructorParameters<typeof AnalyzeAndCreateSuggestions>[0]["repository"],
    generator: ConstructorParameters<typeof AnalyzeAndCreateSuggestions>[0]["generator"],
    aiDataSharingConsent: ConstructorParameters<
      typeof AnalyzeAndCreateSuggestions
    >[0]["aiDataSharingConsent"],
    clientAppVersion: ConstructorParameters<
      typeof AnalyzeAndCreateSuggestions
    >[0]["clientAppVersion"],
    unitOfWork: ConstructorParameters<typeof AnalyzeAndCreateSuggestions>[0]["unitOfWork"],
    contextBuilder: ConstructorParameters<typeof AnalyzeAndCreateSuggestions>[0]["contextBuilder"],
    entitlementReader: ConstructorParameters<
      typeof AnalyzeAndCreateSuggestions
    >[0]["entitlementReader"],
    userMutationLock: ConstructorParameters<
      typeof AnalyzeAndCreateSuggestions
    >[0]["userMutationLock"],
  ) =>
    new AnalyzeAndCreateSuggestions({
      repository,
      generator,
      aiDataSharingConsent,
      clientAppVersion,
      unitOfWork,
      contextBuilder,
      entitlementReader,
      userMutationLock,
      logger: new Logger(AnalyzeAndCreateSuggestions.name),
    }),
};

export const getPendingSuggestionsProvider: FactoryProvider<GetPendingSuggestions> = {
  provide: GetPendingSuggestions,
  inject: [AI_SUGGESTION_REPOSITORY, ENTITLEMENT_READER],
  useFactory: (
    repository: ConstructorParameters<typeof GetPendingSuggestions>[0]["repository"],
    entitlementReader: ConstructorParameters<typeof GetPendingSuggestions>[0]["entitlementReader"],
  ) =>
    new GetPendingSuggestions({
      repository,
      entitlementReader,
      logger: new Logger(GetPendingSuggestions.name),
    }),
};

export const handleSuggestionActionProvider: FactoryProvider<HandleSuggestionAction> = {
  provide: HandleSuggestionAction,
  inject: [
    AI_SUGGESTION_REPOSITORY,
    STAGED_TODO_CREATOR,
    ENTITLEMENT_READER,
    UNIT_OF_WORK,
    USER_MUTATION_LOCK,
    MUTATION_LOCK,
    AFTER_COMMIT_TASK_REGISTRY,
    USER_LOCALE_PREFERENCE_READER,
  ],
  useFactory: (
    repository: ConstructorParameters<typeof HandleSuggestionAction>[0]["repository"],
    stagedTodoCreator: StagedTodoCreatorPort,
    entitlementReader: ConstructorParameters<typeof HandleSuggestionAction>[0]["entitlementReader"],
    unitOfWork: ConstructorParameters<typeof HandleSuggestionAction>[0]["unitOfWork"],
    userMutationLock: ConstructorParameters<typeof HandleSuggestionAction>[0]["userMutationLock"],
    mutationLock: ConstructorParameters<typeof HandleSuggestionAction>[0]["mutationLock"],
    afterCommit: ConstructorParameters<typeof HandleSuggestionAction>[0]["afterCommit"],
    localePreferenceReader: ConstructorParameters<
      typeof HandleSuggestionAction
    >[0]["localePreferenceReader"],
  ) =>
    new HandleSuggestionAction({
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
      logger: new Logger(HandleSuggestionAction.name),
    }),
};
