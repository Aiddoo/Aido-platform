import { Logger, type FactoryProvider } from "@nestjs/common";

import { EntitlementService } from "#api/modules/access/application/services/entitlement/entitlement.service";
import { AI_PROVIDER } from "#api/modules/ai-assistance/ai-assistance-parsing.public";
import { WeatherForecastAccess } from "#api/modules/weather/weather-forecast.public";
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
  inject: [AI_SUGGESTION_REPOSITORY, WeatherForecastAccess, WEEKLY_REPORT_READER],
  useFactory: (
    repository: ConstructorParameters<typeof SuggestionContextBuilder>[0]["repository"],
    weatherForecastAccess: ConstructorParameters<
      typeof SuggestionContextBuilder
    >[0]["weatherForecastAccess"],
    reportReader: ConstructorParameters<typeof SuggestionContextBuilder>[0]["reportReader"],
  ) =>
    new SuggestionContextBuilder({
      repository,
      weatherForecastAccess,
      reportReader,
      logger: new Logger(SuggestionContextBuilder.name),
    }),
};

export const analyzeAndCreateSuggestionsProvider: FactoryProvider<AnalyzeAndCreateSuggestions> = {
  provide: AnalyzeAndCreateSuggestions,
  inject: [AI_SUGGESTION_REPOSITORY, AI_PROVIDER, UNIT_OF_WORK, SuggestionContextBuilder],
  useFactory: (
    repository: ConstructorParameters<typeof AnalyzeAndCreateSuggestions>[0]["repository"],
    aiProvider: ConstructorParameters<typeof AnalyzeAndCreateSuggestions>[0]["aiProvider"],
    unitOfWork: ConstructorParameters<typeof AnalyzeAndCreateSuggestions>[0]["unitOfWork"],
    contextBuilder: ConstructorParameters<typeof AnalyzeAndCreateSuggestions>[0]["contextBuilder"],
  ) =>
    new AnalyzeAndCreateSuggestions({
      repository,
      aiProvider,
      unitOfWork,
      contextBuilder,
      logger: new Logger(AnalyzeAndCreateSuggestions.name),
    }),
};

export const getPendingSuggestionsProvider: FactoryProvider<GetPendingSuggestions> = {
  provide: GetPendingSuggestions,
  inject: [AI_SUGGESTION_REPOSITORY, EntitlementService],
  useFactory: (
    repository: ConstructorParameters<typeof GetPendingSuggestions>[0]["repository"],
    entitlementService: ConstructorParameters<
      typeof GetPendingSuggestions
    >[0]["entitlementService"],
  ) =>
    new GetPendingSuggestions({
      repository,
      entitlementService,
      logger: new Logger(GetPendingSuggestions.name),
    }),
};

export const handleSuggestionActionProvider: FactoryProvider<HandleSuggestionAction> = {
  provide: HandleSuggestionAction,
  inject: [AI_SUGGESTION_REPOSITORY, RECURRING_TODO_CREATOR, EntitlementService],
  useFactory: (
    repository: ConstructorParameters<typeof HandleSuggestionAction>[0]["repository"],
    recurringTodoCreator: ConstructorParameters<
      typeof HandleSuggestionAction
    >[0]["recurringTodoCreator"],
    entitlementService: ConstructorParameters<
      typeof HandleSuggestionAction
    >[0]["entitlementService"],
  ) =>
    new HandleSuggestionAction({
      repository,
      recurringTodoCreator,
      entitlementService,
      logger: new Logger(HandleSuggestionAction.name),
    }),
};
