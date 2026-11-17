import { Module } from "@nestjs/common";

import { AccessQuotaChargesModule } from "#api/modules/access/quota-charges/access-quota-charges.public";
import { IdentityUserPreferencesModule } from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import { PlanningTodoCategoriesQueriesModule } from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import { PlanningTodosQueriesModule } from "#api/modules/planning/todos/planning-todos-queries.public";

import { AiAssistanceAiGenerationsModule } from "../ai-generations/ai-assistance-ai-generations.module.js";
import { AI_ASSISTANCE_PARSED_DRAFTS_PROVIDERS } from "./ai-assistance-parsed-drafts.providers.js";
import { ChargedGenerationPort } from "./application/ports/charged-generation.port.js";
import { AiDataSharingConsentGuard } from "./presentation/http/guards/ai-data-sharing-consent.guard.js";
import { AiController } from "./presentation/http/v1/ai.controller.js";

/** 글·메모를 할 일로 바꾸는 AI 파싱. 동의 guard와 사용량 정산은 같은 한도를 쓰는 voice도 쓴다. */
@Module({
  imports: [
    AccessQuotaChargesModule,
    AiAssistanceAiGenerationsModule,
    IdentityUserPreferencesModule,
    PlanningTodoCategoriesQueriesModule,
    PlanningTodosQueriesModule,
  ],
  controllers: [AiController],
  providers: [...AI_ASSISTANCE_PARSED_DRAFTS_PROVIDERS],
  exports: [ChargedGenerationPort, AiDataSharingConsentGuard],
})
export class AiAssistanceParsedDraftsModule {}
