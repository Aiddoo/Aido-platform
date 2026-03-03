import { ErrorCode } from "@aido/errors";
import {
	Controller,
	Get,
	Logger,
	Param,
	ParseIntPipe,
	Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Timezone } from "@/common/decorators/timezone.decorator";

import {
	ApiDoc,
	ApiNotFoundError,
	ApiSuccessResponse,
	ApiUnauthorizedError,
	SWAGGER_TAGS,
} from "@/common/swagger";

import { CurrentUser, type CurrentUserPayload } from "../auth/decorators";
import { AiReportService } from "./ai-report.service";
import {
	AiReportListResponseDto,
	AiReportResponseDto,
	GetAiReportsQueryDto,
	ReportStatusResponseDto,
} from "./dtos";

/**
 * AI 리포트 API 컨트롤러
 *
 * 주간/월간 AI 분석 리포트를 조회하는 API입니다.
 *
 * ### 주요 기능
 * - 리포트 상태 조회 (다음 리포트 예정일, 최신 리포트)
 * - 리포트 목록 조회 (타입별 필터링)
 * - 리포트 상세 조회
 */
@ApiTags(SWAGGER_TAGS.AI)
@ApiBearerAuth()
@Controller("ai/reports")
export class AiReportController {
	readonly #logger = new Logger(AiReportController.name);

	constructor(private readonly aiReportService: AiReportService) {}

	/**
	 * GET /ai/reports/status - 리포트 상태 조회
	 */
	@Get("status")
	@ApiDoc({
		summary: "AI 리포트 상태 조회",
		operationId: "getAiReportStatus",
		description: `다음 주간/월간 리포트 예정일과 최신 리포트를 반환합니다.

**응답 필드**
- \`nextWeeklyAt\`: 다음 주간 리포트 생성 예정 시각 (UTC)
- \`nextMonthlyAt\`: 다음 월간 리포트 생성 예정 시각 (UTC)
- \`daysUntilWeekly\`: 주간 리포트까지 남은 일수
- \`daysUntilMonthly\`: 월간 리포트까지 남은 일수
- \`latestWeekly\`: 최근 주간 리포트 (없으면 null)
- \`latestMonthly\`: 최근 월간 리포트 (없으면 null)`,
	})
	@ApiSuccessResponse({ type: ReportStatusResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getStatus(
		@CurrentUser() user: CurrentUserPayload,
		@Timezone() tz: string,
	): Promise<ReportStatusResponseDto> {
		this.#logger.debug(`리포트 상태 조회: userId=${user.userId}`);

		const status = await this.aiReportService.getReportStatus(user.userId, tz);

		return { status };
	}

	/**
	 * GET /ai/reports - 리포트 목록 조회
	 */
	@Get()
	@ApiDoc({
		summary: "AI 리포트 목록 조회",
		operationId: "getAiReports",
		description: `주간/월간 AI 분석 리포트 목록을 조회합니다.

**쿼리 파라미터**
- \`type\`: 리포트 타입 필터 (WEEKLY/MONTHLY, 미지정 시 전체)
- \`limit\`: 최대 조회 수 (1-50, 기본값: 10)`,
	})
	@ApiSuccessResponse({ type: AiReportListResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getReports(
		@CurrentUser() user: CurrentUserPayload,
		@Query() query: GetAiReportsQueryDto,
	): Promise<AiReportListResponseDto> {
		this.#logger.debug(
			`리포트 목록 조회: userId=${user.userId}, type=${query.type}, limit=${query.limit}`,
		);

		const reports = await this.aiReportService.getReports(user.userId, {
			type: query.type as "WEEKLY" | "MONTHLY" | undefined,
			limit: query.limit,
		});

		return { reports };
	}

	/**
	 * GET /ai/reports/:id - 리포트 상세 조회
	 */
	@Get(":id")
	@ApiDoc({
		summary: "AI 리포트 상세 조회",
		operationId: "getAiReportById",
		description: "특정 AI 분석 리포트의 상세 정보를 조회합니다.",
	})
	@ApiSuccessResponse({ type: AiReportResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.AI_1304)
	async getReport(
		@CurrentUser() user: CurrentUserPayload,
		@Param("id", ParseIntPipe) id: number,
	): Promise<AiReportResponseDto> {
		this.#logger.debug(`리포트 상세 조회: id=${id}, userId=${user.userId}`);

		const report = await this.aiReportService.getReportById(user.userId, id);

		return { report };
	}
}
