import { Module } from "@nestjs/common";

import { AccessQuotaChargesModule } from "#api/modules/access/quota-charges/access-quota-charges.public";
import { AiAssistanceActionPlanDraftsModule } from "#api/modules/ai-assistance/action-plan-drafts/ai-assistance-action-plan-drafts.public";
import { AiAssistanceAiGenerationsModule } from "#api/modules/ai-assistance/ai-generations/ai-assistance-ai-generations.public";
import { AiAssistanceParsedDraftsModule } from "#api/modules/ai-assistance/parsed-drafts/ai-assistance-parsed-drafts.public";
import { IdentityUserPreferencesModule } from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import { NotesMemosModule } from "#api/modules/notes/memos/notes-memos.public";
import { PlanningTodoCategoriesQueriesModule } from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import { PlanningTodosQueriesModule } from "#api/modules/planning/todos/planning-todos-queries.public";
import { PlanningTodosModule } from "#api/modules/planning/todos/planning-todos.public";

import { ChargedPlanRunnerPort } from "./application/ports/charged-plan-runner.port.js";
import { PlanResultReplayFactoryPort } from "./application/ports/plan-result-replay-factory.port.js";
import { PlanningContextReaderPort } from "./application/ports/planning-context.reader.port.js";
import { ActionPlanController } from "./presentation/http/v1/action-plan.controller.js";
import { QuickPlanController } from "./presentation/http/v1/quick-plan.controller.js";
import { VOICE_PLAN_APPLICATIONS_PROVIDERS } from "./voice-plan-applications.providers.js";

/** 빠른 계획과 계획 적용. 서버는 말한 글자를 저장하지 않고 사용량과 멱등 기록만 남긴다. */
@Module({
  imports: [
    AccessQuotaChargesModule,
    AiAssistanceAiGenerationsModule,
    AiAssistanceParsedDraftsModule,
    AiAssistanceActionPlanDraftsModule,
    IdentityUserPreferencesModule,
    NotesMemosModule,
    PlanningTodoCategoriesQueriesModule,
    PlanningTodosModule,
    PlanningTodosQueriesModule,
  ],
  controllers: [QuickPlanController, ActionPlanController],
  providers: [...VOICE_PLAN_APPLICATIONS_PROVIDERS],
  exports: [ChargedPlanRunnerPort, PlanningContextReaderPort, PlanResultReplayFactoryPort],
})
export class VoicePlanApplicationsModule {}
