import { Module } from "@nestjs/common";

import { AccessQuotasModule } from "#api/modules/access/quotas/access-quotas.public";
import { IdentitySettingsModule } from "#api/modules/identity/identity-settings.public";
import { IdentityUserAccessModule } from "#api/modules/identity/users/identity-users.public";
import { NotificationPushModule } from "#api/modules/notification/notification-delivery.public";
import { PlanningTodoQueriesModule } from "#api/modules/planning/todos/planning-todo-queries.public";
import { PlanningTodosModule } from "#api/modules/planning/todos/planning-todos.public";

import { AiAssistanceGenerationModule } from "../generation/ai-assistance-generation.module.js";
import { AI_ASSISTANCE_SUGGESTIONS_PROVIDERS } from "./ai-assistance-suggestions.providers.js";
import { AiSuggestionController } from "./presentation/http/v1/ai-suggestion.controller.js";

/**
 * 사용자의 할 일 패턴을 분석해 반복 할 일을 제안한다. 매시 정각 디스패치가 현지 제안 창(09시대) 사용자마다
 * 분석 작업을 등록하고, 새 제안이 생기면 알림을 보낸다. 수락하면 같은 트랜잭션에 반복 할 일을 만든다.
 */
@Module({
  imports: [
    AccessQuotasModule,
    IdentitySettingsModule,
    IdentityUserAccessModule,
    AiAssistanceGenerationModule,
    NotificationPushModule,
    PlanningTodoQueriesModule,
    PlanningTodosModule,
  ],
  controllers: [AiSuggestionController],
  providers: [...AI_ASSISTANCE_SUGGESTIONS_PROVIDERS],
})
export class AiAssistanceSuggestionsModule {}
