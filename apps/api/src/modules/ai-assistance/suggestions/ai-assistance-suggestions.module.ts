import { Module } from "@nestjs/common";

import { AccessQuotasModule } from "#api/modules/access/quotas/access-quotas.public";
import { IdentityUserAccessModule } from "#api/modules/identity/users/identity-users.public";
import { NotificationPushModule } from "#api/modules/notification/notification-delivery.public";
import { PlanningTodosModule } from "#api/modules/planning/todos/planning-todos.public";
import { WeatherForecastsModule } from "#api/modules/weather/forecasts/weather-forecasts.public";

import { AiAssistanceGenerationModule } from "../generation/ai-assistance-generation.module.js";
import { AiAssistanceReportsModule } from "../reports/ai-assistance-reports.module.js";
import { AI_ASSISTANCE_SUGGESTIONS_PROVIDERS } from "./ai-assistance-suggestions.providers.js";
import { AiSuggestionController } from "./presentation/http/v1/ai-suggestion.controller.js";

/**
 * 사용자의 할 일 패턴을 분석해 반복 할 일을 제안한다. 매시 정각 디스패치가 현지 07시대 사용자마다
 * 분석 작업을 등록하고, 새 제안이 생기면 알림을 보낸다. 수락하면 같은 트랜잭션에 반복 할 일을 만든다.
 */
@Module({
  imports: [
    AccessQuotasModule,
    IdentityUserAccessModule,
    AiAssistanceGenerationModule,
    AiAssistanceReportsModule,
    NotificationPushModule,
    PlanningTodosModule,
    WeatherForecastsModule,
  ],
  controllers: [AiSuggestionController],
  providers: [...AI_ASSISTANCE_SUGGESTIONS_PROVIDERS],
})
export class AiAssistanceSuggestionsModule {}
