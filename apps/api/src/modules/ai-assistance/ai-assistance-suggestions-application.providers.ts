import { Logger, type FactoryProvider } from "@nestjs/common";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import { AI_PROVIDER } from "#api/modules/ai-assistance/ai-assistance-parsing.public";
import { USER_MUTATION_LOCK } from "#api/modules/identity/identity-user-access.public";
import { WEATHER_FORECAST_READER } from "#api/modules/weather/weather-forecast.public";
import { UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { AI_SUGGESTION_REPOSITORY } from "./application/ports/suggestions/ai-suggestion.repository.port.js";
import { RECURRING_TODO_CREATOR } from "./application/ports/suggestions/recurring-todo-creator.port.js";
import { WEEKLY_REPORT_READER } from "./application/ports/suggestions/weekly-report-reader.port.js";
import { SuggestionContextBuilder } from "./application/services/suggestions/suggestion-context.builder.js";
import { AnalyzeAndCreateSuggestions } from "./application/use-cases/suggestions/analyze-and-create-suggestions.use-case.js";
import { GetPendingSuggestions } from "./application/use-cases/suggestions/get-pending-suggestions.use-case.js";
import { HandleSuggestionAction } from "./application/use-cases/suggestions/handle-suggestion-action.use-case.js";

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
    AI_PROVIDER,
    UNIT_OF_WORK,
    SuggestionContextBuilder,
    ENTITLEMENT_READER,
    USER_MUTATION_LOCK,
  ],
  useFactory: (
    repository: ConstructorParameters<typeof AnalyzeAndCreateSuggestions>[0]["repository"],
    aiProvider: ConstructorParameters<typeof AnalyzeAndCreateSuggestions>[0]["aiProvider"],
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
      aiProvider,
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
    RECURRING_TODO_CREATOR,
    ENTITLEMENT_READER,
    UNIT_OF_WORK,
    USER_MUTATION_LOCK,
  ],
  useFactory: (
    repository: ConstructorParameters<typeof HandleSuggestionAction>[0]["repository"],
    recurringTodoCreator: ConstructorParameters<
      typeof HandleSuggestionAction
    >[0]["recurringTodoCreator"],
    entitlementReader: ConstructorParameters<typeof HandleSuggestionAction>[0]["entitlementReader"],
    unitOfWork: ConstructorParameters<typeof HandleSuggestionAction>[0]["unitOfWork"],
    userMutationLock: ConstructorParameters<typeof HandleSuggestionAction>[0]["userMutationLock"],
  ) =>
    new HandleSuggestionAction({
      repository,
      recurringTodoCreator,
      entitlementReader,
      unitOfWork,
      userMutationLock,
      logger: new Logger(HandleSuggestionAction.name),
    }),
};
