import { Logger, type FactoryProvider } from "@nestjs/common";

import { EntitlementService } from "#api/modules/access/application/services/entitlement/entitlement.service";
import { UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { AI_PROVIDER } from "./application/ports/parsing/ai-provider.port.js";
import { AI_USAGE_REPOSITORY } from "./application/ports/parsing/ai-usage.repository.port.js";
import { USER_CATEGORY_READER } from "./application/ports/parsing/user-category-reader.port.js";
import { AiUsageMeter } from "./application/services/parsing/ai-usage-meter.service.js";
import { GetAiUsage } from "./application/use-cases/parsing/get-ai-usage.use-case.js";
import { ParseMemo } from "./application/use-cases/parsing/parse-memo.use-case.js";
import { ParseTodo } from "./application/use-cases/parsing/parse-todo.use-case.js";

export const getAiUsageProvider: FactoryProvider<GetAiUsage> = {
  provide: GetAiUsage,
  inject: [AI_USAGE_REPOSITORY, EntitlementService],
  useFactory: (
    repository: ConstructorParameters<typeof GetAiUsage>[0]["repository"],
    entitlementService: ConstructorParameters<typeof GetAiUsage>[0]["entitlementService"],
  ) => new GetAiUsage({ repository, entitlementService }),
};

export const aiUsageMeterProvider: FactoryProvider<AiUsageMeter> = {
  provide: AiUsageMeter,
  inject: [UNIT_OF_WORK, AI_USAGE_REPOSITORY, EntitlementService],
  useFactory: (
    unitOfWork: ConstructorParameters<typeof AiUsageMeter>[0]["unitOfWork"],
    repository: ConstructorParameters<typeof AiUsageMeter>[0]["repository"],
    entitlementService: ConstructorParameters<typeof AiUsageMeter>[0]["entitlementService"],
  ) =>
    new AiUsageMeter({
      unitOfWork,
      repository,
      entitlementService,
      logger: new Logger(AiUsageMeter.name),
    }),
};

export const parseMemoProvider: FactoryProvider<ParseMemo> = {
  provide: ParseMemo,
  inject: [AI_PROVIDER, USER_CATEGORY_READER, AiUsageMeter],
  useFactory: (
    aiProvider: ConstructorParameters<typeof ParseMemo>[0]["aiProvider"],
    categoryReader: ConstructorParameters<typeof ParseMemo>[0]["categoryReader"],
    usageMeter: ConstructorParameters<typeof ParseMemo>[0]["usageMeter"],
  ) =>
    new ParseMemo({
      aiProvider,
      categoryReader,
      usageMeter,
      logger: new Logger(ParseMemo.name),
    }),
};

export const parseTodoProvider: FactoryProvider<ParseTodo> = {
  provide: ParseTodo,
  inject: [AI_PROVIDER, USER_CATEGORY_READER, AiUsageMeter],
  useFactory: (
    aiProvider: ConstructorParameters<typeof ParseTodo>[0]["aiProvider"],
    categoryReader: ConstructorParameters<typeof ParseTodo>[0]["categoryReader"],
    usageMeter: ConstructorParameters<typeof ParseTodo>[0]["usageMeter"],
  ) =>
    new ParseTodo({
      aiProvider,
      categoryReader,
      usageMeter,
      logger: new Logger(ParseTodo.name),
    }),
};
