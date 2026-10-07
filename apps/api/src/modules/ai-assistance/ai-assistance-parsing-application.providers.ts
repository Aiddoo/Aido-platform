import { Logger, type FactoryProvider } from "@nestjs/common";

import { AI_PROVIDER } from "./application/ports/parsing/ai-provider.port.js";
import { AI_QUOTA } from "./application/ports/parsing/ai-quota.port.js";
import { USER_CATEGORY_READER } from "./application/ports/parsing/user-category-reader.port.js";
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
  inject: [AI_PROVIDER, USER_CATEGORY_READER, AI_QUOTA],
  useFactory: (
    aiProvider: ConstructorParameters<typeof ParseMemo>[0]["aiProvider"],
    categoryReader: ConstructorParameters<typeof ParseMemo>[0]["categoryReader"],
    quota: ConstructorParameters<typeof ParseMemo>[0]["quota"],
  ) => new ParseMemo({ aiProvider, categoryReader, quota, logger: new Logger(ParseMemo.name) }),
};

export const parseTodoProvider: FactoryProvider<ParseTodo> = {
  provide: ParseTodo,
  inject: [AI_PROVIDER, USER_CATEGORY_READER, AI_QUOTA],
  useFactory: (
    aiProvider: ConstructorParameters<typeof ParseTodo>[0]["aiProvider"],
    categoryReader: ConstructorParameters<typeof ParseTodo>[0]["categoryReader"],
    quota: ConstructorParameters<typeof ParseTodo>[0]["quota"],
  ) => new ParseTodo({ aiProvider, categoryReader, quota, logger: new Logger(ParseTodo.name) }),
};
