import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { AiModule } from "../ai/ai.module";

import { AiReportController } from "./ai-report.controller";
import { AiReportRepository } from "./ai-report.repository";
import { AiReportService } from "./ai-report.service";
import { ReportGenerationJob } from "./jobs/report-generation.job";
import {
	AI_REPORT_QUEUE,
	ReportGenerationProcessor,
} from "./processors/report-generation.processor";
import { ReportAggregatorService } from "./report-aggregator.service";
import { ReportGeneratorService } from "./report-generator.service";

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
	imports: [AiModule, BullModule.registerQueue({ name: AI_REPORT_QUEUE })],
	controllers: [AiReportController],
	providers: [
		AiReportRepository,
		AiReportService,
		ReportAggregatorService,
		ReportGeneratorService,
		ReportGenerationJob,
		ReportGenerationProcessor,
	],
	exports: [AiReportService],
})
export class AiReportModule {}
