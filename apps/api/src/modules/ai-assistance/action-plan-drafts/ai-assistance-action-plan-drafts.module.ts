import { Module } from "@nestjs/common";

import { IdentitySettingsModule } from "#api/modules/identity/identity-settings.public";

import { AiAssistanceAiGenerationsModule } from "../ai-generations/ai-assistance-ai-generations.module.js";
import { AI_ASSISTANCE_ACTION_PLAN_DRAFTS_PROVIDERS } from "./ai-assistance-action-plan-drafts.providers.js";
import { ActionPlanGeneratorPort } from "./application/ports/action-plan-generator.port.js";

/** 말·글을 실행 계획으로 바꾸는 능력. 사용량·저장은 소비 Context(voice)가 소유한다. */
@Module({
  imports: [AiAssistanceAiGenerationsModule, IdentitySettingsModule],
  providers: [...AI_ASSISTANCE_ACTION_PLAN_DRAFTS_PROVIDERS],
  exports: [ActionPlanGeneratorPort],
})
export class AiAssistanceActionPlanDraftsModule {}
