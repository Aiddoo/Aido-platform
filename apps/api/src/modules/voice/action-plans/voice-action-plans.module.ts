import { Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-quota.public";
import { AiAssistanceGenerationModule } from "#api/modules/ai-assistance/generation/ai-assistance-generation.public";
import { AiAssistanceParsingModule } from "#api/modules/ai-assistance/parsing/ai-assistance-parsing.public";
import { AiAssistancePlanningModule } from "#api/modules/ai-assistance/planning/ai-assistance-planning.public";
import { IdentitySettingsModule } from "#api/modules/identity/identity-settings.public";
import { NotesMemosModule } from "#api/modules/notes/memos/notes-memos.public";
import { PlanningCategoriesModule } from "#api/modules/planning/categories/planning-categories.public";
import { PlanningTodosModule } from "#api/modules/planning/todos/planning-todos.public";

import { ChargedPlanRunnerPort } from "./application/ports/charged-plan-runner.port.js";
import { PlanningContextReaderPort } from "./application/ports/planning-context.reader.port.js";
import { PlanResultReplayCache } from "./infrastructure/adapters/in-memory-plan-result-replay.adapter.js";
import { ActionPlanController } from "./presentation/http/v1/action-plan.controller.js";
import { QuickPlanController } from "./presentation/http/v1/quick-plan.controller.js";
import { VOICE_ACTION_PLANS_PROVIDERS } from "./voice-action-plans.providers.js";

/** 빠른 계획과 계획 적용. 서버는 말한 글자를 저장하지 않고 사용량과 멱등 기록만 남긴다. */
@Module({
  imports: [
    AccessModule,
    AiAssistanceGenerationModule,
    AiAssistanceParsingModule,
    AiAssistancePlanningModule,
    IdentitySettingsModule,
    NotesMemosModule,
    PlanningCategoriesModule,
    PlanningTodosModule,
  ],
  controllers: [QuickPlanController, ActionPlanController],
  providers: [...VOICE_ACTION_PLANS_PROVIDERS],
  exports: [ChargedPlanRunnerPort, PlanningContextReaderPort, PlanResultReplayCache],
})
export class VoiceActionPlansModule {}
