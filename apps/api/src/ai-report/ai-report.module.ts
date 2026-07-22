import { Module } from "@nestjs/common";

import { AiModule } from "../ai/ai.module";

import { AiReportFacade } from "./application/facades/ai-report.facade";
import { AI_REPORT_REPOSITORY } from "./application/ports/ai-report.repository.port";
import { TODO_STATS_READER } from "./application/ports/todo-stats.reader.port";
import { GenerateReportUseCase } from "./application/use-cases/generate-report/generate-report.use-case";
import { GetReportByIdUseCase } from "./application/use-cases/get-report-by-id/get-report-by-id.use-case";
import { GetReportStatusUseCase } from "./application/use-cases/get-report-status/get-report-status.use-case";
import { GetReportsUseCase } from "./application/use-cases/get-reports/get-reports.use-case";
import { ReportGenerationJob } from "./infrastructure/jobs/report-generation.job";
import { PrismaAiReportRepository } from "./infrastructure/persistence/prisma-ai-report.repository";
import { PrismaTodoStatsReader } from "./infrastructure/persistence/prisma-todo-stats.reader";
import { ReportGenerationProcessor } from "./infrastructure/processors/report-generation.processor";
import { AiReportController } from "./presentation/ai-report.controller";

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
	imports: [AiModule],
	controllers: [AiReportController],
	providers: [
		AiReportFacade,
		GetReportStatusUseCase,
		GetReportsUseCase,
		GetReportByIdUseCase,
		GenerateReportUseCase,
		ReportGenerationJob,
		ReportGenerationProcessor,
		{ provide: AI_REPORT_REPOSITORY, useClass: PrismaAiReportRepository },
		{ provide: TODO_STATS_READER, useClass: PrismaTodoStatsReader },
	],
	exports: [AiReportFacade],
})
export class AiReportModule {}
