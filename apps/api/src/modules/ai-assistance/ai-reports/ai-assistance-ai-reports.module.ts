import { Module } from "@nestjs/common";

import { AccessQuotaChargesModule } from "#api/modules/access/quota-charges/access-quota-charges.public";
import { IdentityUsersQueriesModule } from "#api/modules/identity/users/identity-users.public";

import { AiAssistanceAiGenerationsModule } from "../ai-generations/ai-assistance-ai-generations.module.js";
import { AI_ASSISTANCE_AI_REPORTS_PROVIDERS } from "./ai-assistance-ai-reports.providers.js";
import { AiReportController } from "./presentation/http/v1/ai-report.controller.js";

/** 주간·월간 AI 분석 리포트. 사용자 현지 주기 시작 직후 매시 디스패치가 생성한다. 알림은 notification이 보낸다 */
@Module({
  imports: [AccessQuotaChargesModule, IdentityUsersQueriesModule, AiAssistanceAiGenerationsModule],
  controllers: [AiReportController],
  providers: [...AI_ASSISTANCE_AI_REPORTS_PROVIDERS],
})
export class AiAssistanceAiReportsModule {}
