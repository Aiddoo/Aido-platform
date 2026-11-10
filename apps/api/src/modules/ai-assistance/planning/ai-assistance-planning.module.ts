import { Module } from "@nestjs/common";

import { IdentitySettingsModule } from "#api/modules/identity/identity-settings.public";

import { AiAssistanceGenerationModule } from "../generation/ai-assistance-generation.module.js";
import { actionPlanGeneratorProvider } from "./ai-assistance-planning-application.providers.js";
import { ACTION_PLAN_GENERATOR } from "./application/ports/action-plan-generator.port.js";
import { ActionPlanGenerator } from "./infrastructure/adapters/ai-action-plan-generator.adapter.js";

/** 말·글을 실행 계획으로 바꾸는 능력. 사용량·저장은 소비 Context(voice)가 소유한다. */
@Module({
  imports: [AiAssistanceGenerationModule, IdentitySettingsModule],
  providers: [
    actionPlanGeneratorProvider,
    { provide: ACTION_PLAN_GENERATOR, useExisting: ActionPlanGenerator },
  ],
  exports: [ACTION_PLAN_GENERATOR],
})
export class AiAssistancePlanningModule {}
