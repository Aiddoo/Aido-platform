import { Module } from "@nestjs/common";

import { AccessQuotasModule } from "#api/modules/access/quotas/access-quotas.public";
import { IdentityUserAccessModule } from "#api/modules/identity/users/identity-users.public";

import { AiAssistanceGenerationModule } from "../generation/ai-assistance-generation.module.js";
import { AI_ASSISTANCE_REPORTS_PROVIDERS } from "./ai-assistance-reports.providers.js";
import { LatestReportStatsReaderPort } from "./application/ports/latest-report-stats.reader.port.js";
import { AiReportController } from "./presentation/http/v1/ai-report.controller.js";

/** 주간·월간 AI 분석 리포트. 사용자 현지 주기 시작 직후 매시 디스패치가 생성한다. 알림은 notification이 보낸다 */
@Module({
  imports: [AccessQuotasModule, IdentityUserAccessModule, AiAssistanceGenerationModule],
  controllers: [AiReportController],
  providers: [...AI_ASSISTANCE_REPORTS_PROVIDERS],
  exports: [LatestReportStatsReaderPort],
})
export class AiAssistanceReportsModule {}
