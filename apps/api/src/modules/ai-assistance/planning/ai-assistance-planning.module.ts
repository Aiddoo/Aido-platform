import { Module } from "@nestjs/common";

import { IdentitySettingsModule } from "#api/modules/identity/identity-settings.public";

import { AiAssistanceGenerationModule } from "../generation/ai-assistance-generation.module.js";
import { AI_ASSISTANCE_PLANNING_PROVIDERS } from "./ai-assistance-planning.providers.js";
import { ActionPlanGeneratorPort } from "./application/ports/action-plan-generator.port.js";

/** 말·글을 실행 계획으로 바꾸는 능력. 사용량·저장은 소비 Context(voice)가 소유한다. */
@Module({
  imports: [AiAssistanceGenerationModule, IdentitySettingsModule],
  providers: [...AI_ASSISTANCE_PLANNING_PROVIDERS],
  exports: [ActionPlanGeneratorPort],
})
export class AiAssistancePlanningModule {}
