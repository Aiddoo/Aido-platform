import { Logger, type FactoryProvider } from "@nestjs/common";

import { AI_PROVIDER } from "./application/ports/parsing/ai-provider.port.js";
import { AI_QUOTA } from "./application/ports/parsing/ai-quota.port.js";
import {
  AI_TASK_SETTINGS,
  type AiTaskSettingsMap,
} from "./application/ports/parsing/ai-task-settings.port.js";
import { USER_CATEGORY_READER } from "./application/ports/parsing/user-category-reader.port.js";
import { USER_LOCALE_PREFERENCE_READER } from "./application/ports/parsing/user-locale-preference.reader.port.js";
import { GetAiUsage } from "./application/use-cases/parsing/get-ai-usage.use-case.js";
import { ParseMemo } from "./application/use-cases/parsing/parse-memo.use-case.js";
import { ParseTodo } from "./application/use-cases/parsing/parse-todo.use-case.js";

export const getAiUsageProvider: FactoryProvider<GetAiUsage> = {
  provide: GetAiUsage,
  inject: [AI_QUOTA],
  useFactory: (quota: ConstructorParameters<typeof GetAiUsage>[0]["quota"]) =>
    new GetAiUsage({ quota }),
};

export const parseMemoProvider: FactoryProvider<ParseMemo> = {
  provide: ParseMemo,
  inject: [
    AI_PROVIDER,
    USER_CATEGORY_READER,
    AI_QUOTA,
    USER_LOCALE_PREFERENCE_READER,
    AI_TASK_SETTINGS,
  ],
  useFactory: (
    aiProvider: ConstructorParameters<typeof ParseMemo>[0]["aiProvider"],
    categoryReader: ConstructorParameters<typeof ParseMemo>[0]["categoryReader"],
    quota: ConstructorParameters<typeof ParseMemo>[0]["quota"],
    localePreferenceReader: ConstructorParameters<typeof ParseMemo>[0]["localePreferenceReader"],
    settings: AiTaskSettingsMap,
  ) =>
    new ParseMemo({
      aiProvider,
      categoryReader,
      quota,
      localePreferenceReader,
      settings: settings["parse-memo"],
      logger: new Logger(ParseMemo.name),
    }),
};

export const parseTodoProvider: FactoryProvider<ParseTodo> = {
  provide: ParseTodo,
  inject: [
    AI_PROVIDER,
    USER_CATEGORY_READER,
    AI_QUOTA,
    USER_LOCALE_PREFERENCE_READER,
    AI_TASK_SETTINGS,
  ],
  useFactory: (
    aiProvider: ConstructorParameters<typeof ParseTodo>[0]["aiProvider"],
    categoryReader: ConstructorParameters<typeof ParseTodo>[0]["categoryReader"],
    quota: ConstructorParameters<typeof ParseTodo>[0]["quota"],
    localePreferenceReader: ConstructorParameters<typeof ParseTodo>[0]["localePreferenceReader"],
    settings: AiTaskSettingsMap,
  ) =>
    new ParseTodo({
      aiProvider,
      categoryReader,
      quota,
      localePreferenceReader,
      settings: settings["parse-todo"],
      logger: new Logger(ParseTodo.name),
    }),
};
