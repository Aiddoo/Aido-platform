import { ErrorCode } from "@aido/api/errors";
import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/sessions/identity-sessions.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { Timezone } from "#api/platform/http/decorators/timezone.decorator";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiForbiddenError,
  ApiNotFoundError,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";

import { GetReportByIdUseCase } from "../../../application/use-cases/get-report-by-id.use-case.js";
import { GetReportStatusUseCase } from "../../../application/use-cases/get-report-status.use-case.js";
import { ListReportsUseCase } from "../../../application/use-cases/list-reports.use-case.js";
import { toAiReportResponse, toReportStatusResponse } from "./ai-report-response.mapper.js";
import {
  AiReportIdParamDto,
  AiReportListResponseDto,
  AiReportResponseDto,
  GetAiReportsQueryDto,
  ReportStatusResponseDto,
} from "./ai-report.dto.js";

const REPORT_STATUS_DESCRIPTION = `다음 주간/월간 리포트 도착 시각과 최신 리포트를 줍니다.

- \`nextWeeklyAt\`은 사용자 시간대의 다음 월요일 11:30, \`nextMonthlyAt\`은 다음 달 1일 11:30입니다. 이 시각에 리포트 푸시가 갑니다.
- 리포트는 월요일(월간은 1일) 00:00~05:59(사용자 시간대) 사이에 직전 주(월~일)·전월 기록으로 만들어집니다. 시간대는 \`X-Timezone\`, 없으면 저장된 사용자 시간대입니다.
- \`daysUntilWeekly\`·\`daysUntilMonthly\`는 사용자 달력 날짜 기준 남은 일수입니다.
- \`latestWeekly\`·\`latestMonthly\`가 null이면 아직 만들어진 리포트가 없습니다.
- 할 일이 없던 주·월에도 리포트가 만들어지며 \`hasActivity\`가 false입니다.
- 같은 기간의 리포트는 한 번만 만들어집니다.`;

const REPORT_LIST_DESCRIPTION = `주간/월간 AI 리포트를 최신순으로 줍니다.

- \`type\`을 생략하면 주간과 월간을 함께 줍니다.
- \`limit\`은 1~50, 기본 10입니다.
- 리포트가 없으면 \`reports\`는 빈 배열입니다.`;

const REPORT_DETAIL_DESCRIPTION = `리포트 하나의 통계와 AI 요약·팁을 줍니다.

- \`periodLabel\`은 리포트 언어에 맞춘 기간 이름입니다. 주간은 "11월 2주차", 올해가 아닌 주는 "2025년 12월 1주차", 월간은 "2026년 3월"처럼 옵니다.
- \`categoryBreakdown\`의 지운 카테고리는 리포트 언어의 "기타"(영어 "Other")로 묶입니다.
- \`aiSummary\`·\`aiTips\`는 리포트를 만든 시점의 언어로 저장된 글입니다.
- \`dailyCompletions\`는 기간 첫날부터 마지막 날까지 날마다 할 일 수와 끝낸 수(빈 날은 0)입니다. 1.16.0 전에 만든 리포트는 null입니다.
- \`aiContentSource\`가 \`AI\`면 모델이 쓴 글이고, \`TEMPLATE\`이면 AI 없이 통계로 채운 글이거나 출처를 남기기 전(2026-10-25 전)에 만든 리포트입니다.`;

/** 유료 사용자의 리포트 조회 HTTP 진입점. */
@ApiTags(SWAGGER_TAGS.AI)
@ApiBearerAuth()
@Controller({ path: "ai/reports", version: API_VERSION.V1 })
export class AiReportController {
  readonly #getReportStatusUseCase: GetReportStatusUseCase;
  readonly #getReportsUseCase: ListReportsUseCase;
  readonly #getReportByIdUseCase: GetReportByIdUseCase;

  constructor(
    getReportStatusUseCase: GetReportStatusUseCase,
    getReportsUseCase: ListReportsUseCase,
    getReportByIdUseCase: GetReportByIdUseCase,
  ) {
    this.#getReportStatusUseCase = getReportStatusUseCase;
    this.#getReportsUseCase = getReportsUseCase;
    this.#getReportByIdUseCase = getReportByIdUseCase;
  }

  @Get("status")
  @ApiDoc({
    summary: "AI 리포트 상태 조회",
    operationId: "getAiReportStatus",
    description: REPORT_STATUS_DESCRIPTION,
  })
  @ApiSuccessResponse({ type: ReportStatusResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiForbiddenError(ErrorCode.AI_1308)
  async getStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Timezone({ preserveIfMissing: true }) tz: string | undefined,
  ): Promise<ReportStatusResponseDto> {
    const status = await this.#getReportStatusUseCase.execute({
      userId: user.userId,
      timezone: tz,
    });

    return { status: toReportStatusResponse(status) };
  }

  @Get()
  @ApiDoc({
    summary: "AI 리포트 목록 조회",
    operationId: "getAiReports",
    description: REPORT_LIST_DESCRIPTION,
  })
  @ApiSuccessResponse({ type: AiReportListResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiForbiddenError(ErrorCode.AI_1308)
  async getReports(
    @CurrentUser() user: CurrentUserPayload,
    @Query({ schema: GetAiReportsQueryDto }) query: GetAiReportsQueryDto,
  ): Promise<AiReportListResponseDto> {
    const { reports, localToday } = await this.#getReportsUseCase.execute({
      userId: user.userId,
      type: query.type,
      limit: query.limit,
    });

    return { reports: reports.map((report) => toAiReportResponse(report, localToday)) };
  }

  @Get(":id")
  @ApiDoc({
    summary: "AI 리포트 상세 조회",
    operationId: "getAiReportById",
    description: REPORT_DETAIL_DESCRIPTION,
  })
  @ApiSuccessResponse({ type: AiReportResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiForbiddenError(ErrorCode.AI_1308)
  @ApiNotFoundError(ErrorCode.AI_1304)
  async getReport(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: AiReportIdParamDto }) params: AiReportIdParamDto,
  ): Promise<AiReportResponseDto> {
    const { report, localToday } = await this.#getReportByIdUseCase.execute({
      userId: user.userId,
      reportId: params.id,
    });

    return { report: toAiReportResponse(report, localToday) };
  }
}
