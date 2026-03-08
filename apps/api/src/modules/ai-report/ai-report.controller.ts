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
	ApiForbiddenError,
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
 * 리포트는 서버에서 자동 생성되며, 프리미엄 유저만 조회 가능합니다.
 *
 * ### 주요 기능
 * - 리포트 상태 조회 (다음 리포트 예정일, 최신 리포트)
 * - 리포트 목록 조회 (타입별 필터링)
 * - 리포트 상세 조회
 *
 * ### 자동 생성 스케줄 (KST 기준)
 * | 타입 | 생성 시점 | 알림 발송 | 분석 대상 |
 * |------|----------|----------|----------|
 * | 주간 | 매주 **월요일 01:00 KST** | **월요일 08:00 KST** | 직전 주 월~일 |
 * | 월간 | 매월 **1일 01:00 KST** | **1일 08:00 KST** | 전월 전체 |
 *
 * ### 안전성
 * - BullMQ jobId (7일 보관) + DB 중복 체크 — 중복 생성/알림 없음
 * - 서버 재시작 시 미처리 잡은 Redis에서 자동 이어서 처리
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

## 📊 응답 필드
| 필드 | 타입 | 설명 |
|------|------|------|
| \`nextWeeklyAt\` | string | 다음 주간 리포트 생성 예정 시각 (ISO 8601, UTC) |
| \`nextMonthlyAt\` | string | 다음 월간 리포트 생성 예정 시각 (ISO 8601, UTC) |
| \`daysUntilWeekly\` | number | 주간 리포트까지 남은 일수 |
| \`daysUntilMonthly\` | number | 월간 리포트까지 남은 일수 |
| \`latestWeekly\` | object \\| null | 최근 주간 리포트 (없으면 null) |
| \`latestMonthly\` | object \\| null | 최근 월간 리포트 (없으면 null) |

## ⏰ 리포트 생성 스케줄 (KST 기준)

| 타입 | 생성 시점 | 알림 발송 | 분석 대상 기간 |
|------|----------|----------|--------------|
| **주간** | 매주 **월요일 01:00 KST** | **월요일 08:00 KST** | 직전 주 월~일 (ISO week) |
| **월간** | 매월 **1일 01:00 KST** | **1일 08:00 KST** | 전월 1일~말일 |

**생성 조건**: \`subscriptionStatus = ACTIVE\` 또는 \`role = ADMIN\`
- 할 일이 0개인 주/월도 리포트는 생성됩니다 (\`hasActivity: false\`, 격려 메시지 포함).
- 같은 기간의 리포트가 이미 존재하면 중복 생성하지 않습니다.
- 리포트 생성 완료 시 푸시 알림이 즉시 발송됩니다.

## 🔒 중복 방지

### 중복 방지 (2중 방어)
| 계층 | 메커니즘 | 효과 |
|------|---------|------|
| **1. BullMQ jobId** | \`report_{TYPE}_{userId}_{periodId}\` (7일 보관) | 같은 기간 동일 유저 중복 잡 방지 |
| **2. DB 중복 체크** | \`exists(userId, type, year, period)\` | 같은 기간 리포트 중복 생성 방지 |

### 서버 재시작 시 동작
- 이미 큐에 들어간 잡: Redis에서 자동 이어서 처리 (유실 없음)
- 이미 처리된 주: 완료된 잡이 7일간 Redis에 보관되어 jobId 중복으로 자동 스킵
- 리포트 중복: 서비스 레벨 \`exists()\` 체크로 같은 기간 리포트 2번 생성 불가

## 🔍 구체적 예시

### 프리미엄 가입 후 첫 리포트는 언제?
\`\`\`
2026-03-04 (수) 06:24 KST  → 프리미엄 가입

--- 주간 리포트 ---
2026-03-09 (월) 01:00 KST  → 주간 리포트 생성 (BullMQ)
                             → 03-03(월)~03-09(일) 데이터 분석
2026-03-09 (월) 08:00 KST  → 주간 리포트 알림 발송 (Scheduler Strategy)

--- 월간 리포트 ---
2026-04-01 (수) 01:00 KST  → 월간 리포트 생성 (BullMQ)
                             → 3월 전체(03-01~03-31) 데이터 분석
2026-04-01 (수) 08:00 KST  → 월간 리포트 알림 발송 (Scheduler Strategy)
\`\`\`

> 프리미엄 가입 이전 데이터도 분석에 포함됩니다 (가입 시점이 아닌 기간 기준).
> 단, 리포트 **조회**는 프리미엄 상태에서만 가능합니다.

## 📱 클라이언트 통합 가이드

### 폴링 전략
- \`nextWeeklyAt\` / \`nextMonthlyAt\`를 기준으로 새 리포트 도착 시점을 예측할 수 있습니다.
- **월요일 08:00 KST 이후** 호출하면 새 주간 리포트를 확인할 수 있습니다.
- \`latestWeekly\` / \`latestMonthly\`가 null이면 아직 리포트가 생성된 적 없는 것입니다.

### 비활동 리포트
할 일을 하나도 만들지 않은 주/월에도 리포트가 생성됩니다.
\`hasActivity: false\`일 때 AI 요약에는 격려성 메시지가 담기므로, UI에서 별도 분기 없이 그대로 표시해도 됩니다.`,
	})
	@ApiSuccessResponse({ type: ReportStatusResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiForbiddenError(ErrorCode.AI_1308)
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
		description: `주간/월간 AI 분석 리포트 목록을 조회합니다. 최신순으로 정렬됩니다.

## 📋 쿼리 파라미터
| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|-------|------|
| \`type\` | string | ❌ | - | \`WEEKLY\` 또는 \`MONTHLY\` (미지정 시 전체) |
| \`limit\` | number | ❌ | 10 | 최대 조회 수 (1-50) |

## 📱 사용 예시
\`\`\`
GET /ai/reports?type=WEEKLY&limit=4   → 최근 주간 리포트 4개
GET /ai/reports?type=MONTHLY          → 최근 월간 리포트 10개 (기본값)
GET /ai/reports?limit=20              → 주간+월간 합쳐서 최근 20개
\`\`\`

프리미엄 가입 직후에는 아직 리포트가 없으므로 빈 배열이 반환됩니다.
첫 주간 리포트는 가입 후 돌아오는 **월요일 08:00 KST** 이후, 첫 월간 리포트는 **다음 달 1일 08:00 KST** 이후 조회 가능합니다.`,
	})
	@ApiSuccessResponse({ type: AiReportListResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiForbiddenError(ErrorCode.AI_1308)
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
		description: `특정 AI 분석 리포트의 상세 정보를 조회합니다.

## 📊 리포트 필드
| 필드 | 타입 | 설명 |
|------|------|------|
| \`id\` | number | 리포트 ID |
| \`type\` | string | \`WEEKLY\` 또는 \`MONTHLY\` |
| \`year\` | number | 연도 (예: 2026) |
| \`period\` | number | 주차(1~53) 또는 월(1~12) |
| \`periodLabel\` | string | 사람이 읽기 쉬운 기간 (예: "2026년 10주차", "2026년 3월") |
| \`dateRange\` | object | \`{ startDate, endDate }\` — 분석 기간 (YYYY-MM-DD) |
| \`stats\` | object | 완료율, 이전 기간 완료율, 연속 일수 등 |
| \`categoryBreakdown\` | array | 카테고리별 \`{ name, color, total, completed, rate }\` |
| \`dayPatterns\` | array | 요일별 \`{ day, total, completed, rate }\` |
| \`timePatterns\` | array | 시간대별 \`{ hour, count }\` |
| \`aiSummary\` | string | AI 요약 (3~5문장, 한국어) |
| \`aiTips\` | string[] | AI 팁 (1~3개, 한국어) |
| \`hasActivity\` | boolean | 해당 기간 할 일 존재 여부 |
| \`generatedAt\` | string | 리포트 생성 시각 (ISO 8601) |`,
	})
	@ApiSuccessResponse({ type: AiReportResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiForbiddenError(ErrorCode.AI_1308)
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
