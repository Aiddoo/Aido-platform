import { Module } from "@nestjs/common";

import { AccessModule, AI_QUOTA as ACCESS_AI_QUOTA } from "#api/modules/access/access-quota.public";

import { PlanningCategoriesModule } from "../planning/planning-categories.public.js";
import { AI_PROVIDERS } from "./ai-assistance-parsing.providers.js";
import { AI_PROVIDER } from "./application/ports/parsing/ai-provider.port.js";
import { AI_QUOTA } from "./application/ports/parsing/ai-quota.port.js";
import { USER_CATEGORY_READER } from "./application/ports/parsing/user-category-reader.port.js";
import { GeminiAiAdapter } from "./infrastructure/adapters/parsing/gemini-ai.adapter.js";
import { TodoCategoryReaderAdapter } from "./infrastructure/adapters/parsing/todo-category-reader.adapter.js";
import { AiUsageGuard } from "./infrastructure/guards/parsing/ai-usage.guard.js";
import { AiController } from "./presentation/controllers/parsing/ai.controller.js";

@Module({
  imports: [AccessModule, PlanningCategoriesModule],
  controllers: [AiController],
  providers: [
    AiUsageGuard,
    { provide: AI_PROVIDER, useClass: GeminiAiAdapter },
    { provide: AI_QUOTA, useExisting: ACCESS_AI_QUOTA },
    { provide: USER_CATEGORY_READER, useClass: TodoCategoryReaderAdapter },
    ...AI_PROVIDERS,
  ],
  exports: [AI_PROVIDER],
})
export class AiAssistanceParsingModule {}
