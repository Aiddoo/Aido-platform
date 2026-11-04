import { Logger, type FactoryProvider } from "@nestjs/common";

import { QUOTA_LEDGER } from "#api/modules/access/access-quota.public";

import { AI_GENERATOR } from "./application/ports/generation/ai-generator.port.js";
import { AI_DATA_SHARING_CONSENT_DECISION_READER } from "./application/ports/parsing/ai-data-sharing-consent.reader.port.js";
import { USER_CATEGORY_READER } from "./application/ports/parsing/user-category-reader.port.js";
import { USER_LOCALE_PREFERENCE_READER } from "./application/ports/parsing/user-locale-preference.reader.port.js";
import { GetAiUsage } from "./application/use-cases/parsing/get-ai-usage.use-case.js";
import { ParseMemo } from "./application/use-cases/parsing/parse-memo.use-case.js";
import { ParseTodo } from "./application/use-cases/parsing/parse-todo.use-case.js";

export const getAiUsageProvider: FactoryProvider<GetAiUsage> = {
  provide: GetAiUsage,
  inject: [QUOTA_LEDGER],
  useFactory: (quota: ConstructorParameters<typeof GetAiUsage>[0]["quota"]) =>
    new GetAiUsage({ quota }),
};

export const parseMemoProvider: FactoryProvider<ParseMemo> = {
  provide: ParseMemo,
  inject: [
    AI_GENERATOR,
    AI_DATA_SHARING_CONSENT_DECISION_READER,
    USER_CATEGORY_READER,
    QUOTA_LEDGER,
    USER_LOCALE_PREFERENCE_READER,
  ],
  useFactory: (
    generator: ConstructorParameters<typeof ParseMemo>[0]["generator"],
    consentReader: ConstructorParameters<typeof ParseMemo>[0]["consentReader"],
    categoryReader: ConstructorParameters<typeof ParseMemo>[0]["categoryReader"],
    quota: ConstructorParameters<typeof ParseMemo>[0]["quota"],
    localePreferenceReader: ConstructorParameters<typeof ParseMemo>[0]["localePreferenceReader"],
  ) =>
    new ParseMemo({
      generator,
      consentReader,
      categoryReader,
      quota,
      localePreferenceReader,
      logger: new Logger(ParseMemo.name),
    }),
};

export const parseTodoProvider: FactoryProvider<ParseTodo> = {
  provide: ParseTodo,
  inject: [
    AI_GENERATOR,
    AI_DATA_SHARING_CONSENT_DECISION_READER,
    USER_CATEGORY_READER,
    QUOTA_LEDGER,
    USER_LOCALE_PREFERENCE_READER,
  ],
  useFactory: (
    generator: ConstructorParameters<typeof ParseTodo>[0]["generator"],
    consentReader: ConstructorParameters<typeof ParseTodo>[0]["consentReader"],
    categoryReader: ConstructorParameters<typeof ParseTodo>[0]["categoryReader"],
    quota: ConstructorParameters<typeof ParseTodo>[0]["quota"],
    localePreferenceReader: ConstructorParameters<typeof ParseTodo>[0]["localePreferenceReader"],
  ) =>
    new ParseTodo({
      generator,
      consentReader,
      categoryReader,
      quota,
      localePreferenceReader,
      logger: new Logger(ParseTodo.name),
    }),
};
