import { Controller, Get, Logger, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";

import {
	ApiDoc,
	ApiSuccessResponse,
	ApiUnauthorizedError,
	SWAGGER_TAGS,
} from "@/common/swagger";

import { CurrentUser, type CurrentUserPayload } from "../auth/decorators";
import { JwtAuthGuard } from "../auth/guards";

import {
	DailyCompletionService,
	type DailyCompletionsRangeResult,
} from "./daily-completion.service";
import {
	DailyCompletionsRangeResponseDto,
	GetDailyCompletionsRangeDto,
} from "./dtos";

/**
 * DailyCompletion API 컨트롤러
 *
 * ## 📊 일일 완료 현황 API
 *
 * 사용자의 할 일 완료 현황을 날짜별로 조회하는 API입니다.
 * 캘린더에서 물고기 아이콘 및 미완료 개수를 표시하는 데 사용됩니다.
 *
 * ### 엔드포인트
 * - GET /daily-completions - 날짜 범위 내 일일 완료 현황 조회
 */
@ApiTags(SWAGGER_TAGS.DAILY_COMPLETIONS)
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("daily-completions")
export class DailyCompletionController {
	readonly #logger = new Logger(DailyCompletionController.name);

	constructor(
		private readonly dailyCompletionService: DailyCompletionService,
	) {}

	/**
	 * 날짜 범위 내 일일 완료 현황 조회 (캘린더용)
	 */
	@Get()
	@ApiQuery({
		name: "startDate",
		required: true,
		description: "조회 시작 날짜 (YYYY-MM-DD)",
		example: "2026-01-01",
	})
	@ApiQuery({
		name: "endDate",
		required: true,
		description: "조회 종료 날짜 (YYYY-MM-DD)",
		example: "2026-01-31",
	})
	@ApiDoc({
		summary: "날짜 범위 내 일일 완료 현황 조회",
		operationId: "getDailyCompletions",
		description: `
## 📊 일일 완료 현황 조회

지정된 날짜 범위 내의 일일 완료 현황을 조회합니다.
캘린더에서 물고기 아이콘을 표시하는 데 사용됩니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 🔍 쿼리 파라미터
| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| \`startDate\` | string | ✅ | 조회 시작일 (YYYY-MM-DD) |
| \`endDate\` | string | ✅ | 조회 종료일 (YYYY-MM-DD) |

### 📝 요청 예시
\`\`\`
GET /daily-completions?startDate=2026-01-01&endDate=2026-01-31
\`\`\`

### 📤 응답 구조
\`\`\`json
{
  "completions": [
    {
      "date": "2026-01-15",
      "totalTodos": 3,
      "completedTodos": 3,
      "isComplete": true,
      "completionRate": 100
    },
    {
      "date": "2026-01-16",
      "totalTodos": 4,
      "completedTodos": 2,
      "isComplete": false,
      "completionRate": 50
    }
  ],
  "totalCompleteDays": 1,
  "dateRange": {
    "startDate": "2026-01-01",
    "endDate": "2026-01-31"
  }
}
\`\`\`

### 📋 응답 필드 설명
| 필드 | 타입 | 설명 |
|------|------|------|
| \`completions[].date\` | string | 날짜 (YYYY-MM-DD) |
| \`completions[].totalTodos\` | number | 해당 날짜의 총 할 일 수 |
| \`completions[].completedTodos\` | number | 완료한 할 일 수 |
| \`completions[].isComplete\` | boolean | 100% 완료 여부 (물고기 표시) |
| \`completions[].completionRate\` | number | 완료율 (0-100) |
| \`totalCompleteDays\` | number | 100% 완료한 날 수 (물고기 개수) |

### 💡 캘린더 UI 매핑
- \`isComplete: true\` → 물고기 아이콘 표시
- \`totalTodos - completedTodos > 0\` → 미완료 개수 표시 (+N)
- \`totalTodos === 0\` → 응답에 해당 날짜 미포함

### ⚡ 성능 최적화
- DB 레벨에서 집계하여 대량 데이터도 빠르게 처리
- Todo가 없는 날짜는 응답에서 제외되어 데이터 전송량 최소화
		`,
	})
	@ApiSuccessResponse({ type: DailyCompletionsRangeResponseDto })
	@ApiUnauthorizedError()
	async getDailyCompletionsRange(
		@CurrentUser() user: CurrentUserPayload,
		@Query() query: GetDailyCompletionsRangeDto,
	): Promise<DailyCompletionsRangeResponseDto> {
		this.#logger.debug(
			`일일 완료 현황 조회: user=${user.userId}, range=${query.startDate}~${query.endDate}`,
		);

		const result = await this.dailyCompletionService.getDailyCompletionsRange({
			userId: user.userId,
			startDate: query.startDate,
			endDate: query.endDate,
		});

		this.#logger.debug(
			`일일 완료 현황 조회 완료: user=${user.userId}, days=${result.completions.length}, completeDays=${result.totalCompleteDays}`,
		);

		return this.#mapToResponse(result);
	}

	/**
	 * 서비스 결과를 응답 DTO로 변환
	 */
	#mapToResponse(
		result: DailyCompletionsRangeResult,
	): DailyCompletionsRangeResponseDto {
		return {
			completions: result.completions.map((c) => ({
				date: c.date,
				totalTodos: c.totalTodos,
				completedTodos: c.completedTodos,
				isComplete: c.isComplete,
				completionRate: c.completionRate,
			})),
			totalCompleteDays: result.totalCompleteDays,
			dateRange: {
				startDate: result.dateRange.startDate,
				endDate: result.dateRange.endDate,
			},
		};
	}
}
