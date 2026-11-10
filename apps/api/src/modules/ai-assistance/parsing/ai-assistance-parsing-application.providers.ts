import { Logger, type FactoryProvider } from "@nestjs/common";

import { QUOTA_LEDGER } from "#api/modules/access/access-quota.public";

import { AI_DATA_SHARING_CONSENT_DECISION_READER } from "../generation/application/ports/ai-data-sharing-consent.reader.port.js";
import { AI_GENERATOR } from "../generation/application/ports/ai-generator.port.js";
import { USER_LOCALE_PREFERENCE_READER } from "../generation/application/ports/user-locale-preference.reader.port.js";
import { UPCOMING_TODO_READER } from "./application/ports/upcoming-todo.reader.port.js";
import { USER_CATEGORY_READER } from "./application/ports/user-category.reader.port.js";
import { GetAiUsageUseCase } from "./application/use-cases/get-ai-usage.use-case.js";
import { ParseMemoUseCase } from "./application/use-cases/parse-memo.use-case.js";
import { ParseTodoUseCase } from "./application/use-cases/parse-todo.use-case.js";

export const getAiUsageProvider: FactoryProvider<GetAiUsageUseCase> = {
  provide: GetAiUsageUseCase,
  inject: [QUOTA_LEDGER],
  useFactory: (quota: ConstructorParameters<typeof GetAiUsageUseCase>[0]["quota"]) =>
    new GetAiUsageUseCase({ quota }),
};

export const parseMemoProvider: FactoryProvider<ParseMemoUseCase> = {
  provide: ParseMemoUseCase,
  inject: [
    AI_GENERATOR,
    AI_DATA_SHARING_CONSENT_DECISION_READER,
    USER_CATEGORY_READER,
    UPCOMING_TODO_READER,
    QUOTA_LEDGER,
    USER_LOCALE_PREFERENCE_READER,
  ],
  useFactory: (
    generator: ConstructorParameters<typeof ParseMemoUseCase>[0]["generator"],
    consentReader: ConstructorParameters<typeof ParseMemoUseCase>[0]["consentReader"],
    categoryReader: ConstructorParameters<typeof ParseMemoUseCase>[0]["categoryReader"],
    upcomingTodoReader: ConstructorParameters<typeof ParseMemoUseCase>[0]["upcomingTodoReader"],
    quota: ConstructorParameters<typeof ParseMemoUseCase>[0]["quota"],
    localePreferenceReader: ConstructorParameters<
      typeof ParseMemoUseCase
    >[0]["localePreferenceReader"],
  ) =>
    new ParseMemoUseCase({
      generator,
      consentReader,
      categoryReader,
      upcomingTodoReader,
      quota,
      localePreferenceReader,
      logger: new Logger(ParseMemoUseCase.name),
    }),
};

export const parseTodoProvider: FactoryProvider<ParseTodoUseCase> = {
  provide: ParseTodoUseCase,
  inject: [
    AI_GENERATOR,
    AI_DATA_SHARING_CONSENT_DECISION_READER,
    USER_CATEGORY_READER,
    QUOTA_LEDGER,
    USER_LOCALE_PREFERENCE_READER,
  ],
  useFactory: (
    generator: ConstructorParameters<typeof ParseTodoUseCase>[0]["generator"],
    consentReader: ConstructorParameters<typeof ParseTodoUseCase>[0]["consentReader"],
    categoryReader: ConstructorParameters<typeof ParseTodoUseCase>[0]["categoryReader"],
    quota: ConstructorParameters<typeof ParseTodoUseCase>[0]["quota"],
    localePreferenceReader: ConstructorParameters<
      typeof ParseTodoUseCase
    >[0]["localePreferenceReader"],
  ) =>
    new ParseTodoUseCase({
      generator,
      consentReader,
      categoryReader,
      quota,
      localePreferenceReader,
      logger: new Logger(ParseTodoUseCase.name),
    }),
};
