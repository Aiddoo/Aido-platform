import { Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-entitlement.public";
import { IdentityUserAccessModule } from "#api/modules/identity/identity-user-access.public";

import { AiModule } from "./ai-assistance-parsing.module.js";
import {
  generateReportProvider,
  getReportByIdProvider,
  getReportStatusProvider,
  getReportsProvider,
} from "./ai-assistance-reports-application.providers.js";
import { AI_REPORT_REPOSITORY } from "./application/ports/reports/ai-report.repository.port.js";
import { LATEST_REPORT_STATS_READER } from "./application/ports/reports/latest-report-stats.reader.port.js";
import { TODO_STATS_READER } from "./application/ports/reports/todo-stats.reader.port.js";
import { LatestReportStatsReader } from "./infrastructure/adapters/reports/latest-report-stats.reader.js";
import { ReportGenerationJob } from "./infrastructure/jobs/reports/report-generation.job.js";
import { PrismaAiReportRepository } from "./infrastructure/persistence/reports/prisma-ai-report.repository.js";
import { PrismaTodoStatsReader } from "./infrastructure/persistence/reports/prisma-todo-stats.reader.js";
import { ReportGenerationProcessor } from "./infrastructure/processors/reports/report-generation.processor.js";
import { AiReportController } from "./presentation/controllers/reports/ai-report.controller.js";

/**
 * AI 리포트 모듈
 *
 * 주간/월간 AI 분석 리포트를 제공합니다.
 *
 * ### 주요 기능
 * - 리포트 상태 조회 (다음 리포트 예정일, 최신 리포트)
 * - 리포트 목록/상세 조회
 * - 크론 작업을 통한 자동 리포트 생성
 *
 * ### 의존성
 * - AiModule: AI Provider (Gemini)를 통한 분석 콘텐츠 생성
 * - 알림 발송은 SchedulerModule의 Strategy에서 담당
 */
@Module({
  imports: [AccessModule, IdentityUserAccessModule, AiModule],
  controllers: [AiReportController],
  providers: [
    LatestReportStatsReader,
    getReportStatusProvider,
    getReportsProvider,
    getReportByIdProvider,
    generateReportProvider,
    ReportGenerationJob,
    ReportGenerationProcessor,
    { provide: AI_REPORT_REPOSITORY, useClass: PrismaAiReportRepository },
    { provide: TODO_STATS_READER, useClass: PrismaTodoStatsReader },
    {
      provide: LATEST_REPORT_STATS_READER,
      useExisting: LatestReportStatsReader,
    },
  ],
  exports: [LATEST_REPORT_STATS_READER],
})
export class AiReportModule {}
