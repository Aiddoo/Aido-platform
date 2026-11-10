import { Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-entitlement.public";
import { IdentityUserAccessModule } from "#api/modules/identity/identity-user-access.public";

import { AiAssistanceGenerationModule } from "../generation/ai-assistance-generation.module.js";
import { AiAssistanceParsingModule } from "../parsing/ai-assistance-parsing.module.js";
import {
  generateReportProvider,
  getReportByIdProvider,
  getReportStatusProvider,
  listReportsProvider,
} from "./ai-assistance-reports-application.providers.js";
import { AI_REPORT_REPOSITORY } from "./application/ports/ai-report.repository.port.js";
import { LATEST_REPORT_STATS_READER } from "./application/ports/latest-report-stats.reader.port.js";
import { TODO_STATS_READER } from "./application/ports/todo-stats.reader.port.js";
import { LatestReportStatsReaderAdapter } from "./infrastructure/adapters/latest-report-stats-reader.adapter.js";
import { ReportGenerationProcessor } from "./infrastructure/jobs/report-generation.processor.js";
import { ReportGenerationScheduler } from "./infrastructure/jobs/report-generation.scheduler.js";
import { DrizzleAiReportRepository } from "./infrastructure/persistence/drizzle-ai-report.repository.js";
import { DrizzleTodoStatsReader } from "./infrastructure/persistence/drizzle-todo-stats.reader.js";
import { AiReportController } from "./presentation/http/v1/ai-report.controller.js";

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
 * - AiAssistanceGenerationModule: AI_GENERATOR(동의 범위 안의 업체 폴백)로 분석 콘텐츠 생성
 * - 알림 발송은 SchedulerModule의 Strategy에서 담당
 */
@Module({
  imports: [
    AccessModule,
    IdentityUserAccessModule,
    AiAssistanceGenerationModule,
    AiAssistanceParsingModule,
  ],
  controllers: [AiReportController],
  providers: [
    LatestReportStatsReaderAdapter,
    getReportStatusProvider,
    listReportsProvider,
    getReportByIdProvider,
    generateReportProvider,
    ReportGenerationScheduler,
    ReportGenerationProcessor,
    { provide: AI_REPORT_REPOSITORY, useClass: DrizzleAiReportRepository },
    { provide: TODO_STATS_READER, useClass: DrizzleTodoStatsReader },
    {
      provide: LATEST_REPORT_STATS_READER,
      useExisting: LatestReportStatsReaderAdapter,
    },
  ],
  exports: [LATEST_REPORT_STATS_READER],
})
export class AiAssistanceReportsModule {}
