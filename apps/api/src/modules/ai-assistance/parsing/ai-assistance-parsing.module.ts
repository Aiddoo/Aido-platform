import { Module } from "@nestjs/common";

import { AccessQuotasModule } from "#api/modules/access/quotas/access-quotas.public";
import { IdentitySettingsModule } from "#api/modules/identity/identity-settings.public";
import { PlanningCategoriesModule } from "#api/modules/planning/categories/planning-categories.public";
import { PlanningTodosModule } from "#api/modules/planning/todos/planning-todos.public";

import { AiAssistanceGenerationModule } from "../generation/ai-assistance-generation.module.js";
import { AI_ASSISTANCE_PARSING_PROVIDERS } from "./ai-assistance-parsing.providers.js";
import { ChargedGenerationPort } from "./application/ports/charged-generation.port.js";
import { AiDataSharingConsentGuard } from "./presentation/http/guards/ai-data-sharing-consent.guard.js";
import { AiController } from "./presentation/http/v1/ai.controller.js";

/** 글·메모를 할 일로 바꾸는 AI 파싱. 동의 guard와 사용량 정산은 같은 한도를 쓰는 voice도 쓴다. */
@Module({
  imports: [
    AccessQuotasModule,
    AiAssistanceGenerationModule,
    IdentitySettingsModule,
    PlanningCategoriesModule,
    PlanningTodosModule,
  ],
  controllers: [AiController],
  providers: [...AI_ASSISTANCE_PARSING_PROVIDERS],
  exports: [ChargedGenerationPort, AiDataSharingConsentGuard],
})
export class AiAssistanceParsingModule {}
