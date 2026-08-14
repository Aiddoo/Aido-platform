import { ErrorCode } from "@aido/errors";
import { Controller, Get, Logger, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";

import { UserIdParamDto } from "@/shared/presentation/dtos";
import {
	ApiDoc,
	ApiForbiddenError,
	ApiSuccessResponse,
	ApiUnauthorizedError,
	SWAGGER_TAGS,
} from "@/shared/presentation/swagger";

import { CurrentUser, type CurrentUserPayload } from "../../auth/presentation/decorators";
import { GetDailyCompletionsUseCase } from "../application/queries/get-daily-completions/get-daily-completions.use-case";
import { GetFriendDailyCompletionsUseCase } from "../application/queries/get-friend-daily-completions/get-friend-daily-completions.use-case";
import type { DailyCompletionsRange } from "../domain/daily-completion";
import { DailyCompletionsRangeResponseDto, GetDailyCompletionsRangeDto } from "./dtos";

@ApiTags(SWAGGER_TAGS.DAILY_COMPLETIONS)
@ApiBearerAuth()
@Controller("daily-completions")
export class DailyCompletionController {
	readonly #logger = new Logger(DailyCompletionController.name);

	constructor(
		private readonly getDailyCompletionsUseCase: GetDailyCompletionsUseCase,
		private readonly getFriendDailyCompletionsUseCase: GetFriendDailyCompletionsUseCase,
	) {}

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
## 일일 완료 현황 조회

지정된 날짜 범위 내의 일일 완료 현황을 조회합니다.
캘린더에서 물고기 아이콘을 표시하는 데 사용됩니다.

### 인증 필요
\`Authorization: Bearer {accessToken}\`

### 쿼리 파라미터
| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| \`startDate\` | string | ✅ | 조회 시작일 (YYYY-MM-DD) |
| \`endDate\` | string | ✅ | 조회 종료일 (YYYY-MM-DD) |

### 요청 예시
\`\`\`
GET /daily-completions?startDate=2026-01-01&endDate=2026-01-31
\`\`\`

### 응답 구조
\`\`\`json
{
  "completions": [
    {
      "date": "2026-01-15",
      "totalTodos": 3,
      "completedTodos": 3,
      "isComplete": true,
      "completionRate": 100,
      "categoryColors": ["#FF6B43", "#4A90D9"]
    },
    {
      "date": "2026-01-16",
      "totalTodos": 4,
      "completedTodos": 2,
      "isComplete": false,
      "completionRate": 50,
      "categoryColors": ["#FF6B43"]
    }
  ],
  "totalCompleteDays": 1,
  "dateRange": {
    "startDate": "2026-01-01",
    "endDate": "2026-01-31"
  }
}
\`\`\`

### 응답 필드 설명
| 필드 | 타입 | 설명 |
|------|------|------|
| \`completions[].date\` | string | 날짜 (YYYY-MM-DD) |
| \`completions[].totalTodos\` | number | 해당 날짜의 총 할 일 수 |
| \`completions[].completedTodos\` | number | 완료한 할 일 수 |
| \`completions[].isComplete\` | boolean | 100% 완료 여부 (물고기 표시) |
| \`completions[].completionRate\` | number | 완료율 (0-100) |
| \`completions[].categoryColors\` | string[] | 해당 날짜 투두의 카테고리 색상 (HEX, 중복 제거) |
| \`totalCompleteDays\` | number | 100% 완료한 날 수 (물고기 개수) |

### 캘린더 UI 매핑
- \`isComplete: true\` → 물고기 아이콘 표시
- \`totalTodos - completedTodos > 0\` → 미완료 개수 표시 (+N)
- \`categoryColors\` → 날짜 아래 색상 점(dot) 표시
- \`totalTodos === 0\` → 응답에 해당 날짜 미포함

### 성능 최적화
- DB 레벨에서 집계하여 대량 데이터도 빠르게 처리
- Todo가 없는 날짜는 응답에서 제외되어 데이터 전송량 최소화
		`,
	})
	@ApiSuccessResponse({ type: DailyCompletionsRangeResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getDailyCompletionsRange(
		@CurrentUser() user: CurrentUserPayload,
		@Query() query: GetDailyCompletionsRangeDto,
	): Promise<DailyCompletionsRangeResponseDto> {
		this.#logger.debug(
			`일일 완료 현황 조회: user=${user.userId}, range=${query.startDate}~${query.endDate}`,
		);

		const result = await this.getDailyCompletionsUseCase.execute({
			userId: user.userId,
			startDate: query.startDate,
			endDate: query.endDate,
		});

		this.#logger.debug(
			`일일 완료 현황 조회 완료: user=${user.userId}, days=${result.completions.length}, completeDays=${result.totalCompleteDays}`,
		);

		return this.#mapToResponse(result);
	}

	@Get("friends/:userId")
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
		summary: "친구의 날짜 범위 내 일일 완료 현황 조회",
		operationId: "getFriendDailyCompletions",
		description: `
## 친구 일일 완료 현황 조회

친구의 지정된 날짜 범위 내 일일 완료 현황을 조회합니다.
친구 캘린더에서 물고기 아이콘·카테고리 점을 표시하는 데 사용됩니다.

맞팔 관계여야만 조회 가능하며, 공개(PUBLIC) 할 일만 집계합니다 —
\`GET /todos/friends/{userId}\` 목록과 같은 공개 기준이라 캘린더 마커와
날짜별 목록이 항상 일치합니다.

### 인증 필요
\`Authorization: Bearer {accessToken}\`

### 요청 예시
\`\`\`
GET /daily-completions/friends/{userId}?startDate=2026-01-01&endDate=2026-01-31
\`\`\`

응답 구조는 \`GET /daily-completions\`와 동일합니다 (PUBLIC 할 일 기준 집계).

#### 에러 케이스

| 케이스 | 응답 |
|--------|------|
| 맞팔 관계가 아닌 경우 | \`403 Forbidden\` (FOLLOW_0906) |
| startDate가 endDate보다 이후 | \`400 Bad Request\` (SYS_0002) |
| 잘못된 날짜 형식 | \`400 Bad Request\` (SYS_0002) |
		`,
	})
	@ApiSuccessResponse({ type: DailyCompletionsRangeResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiForbiddenError(ErrorCode.FOLLOW_0906)
	async getFriendDailyCompletions(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: UserIdParamDto,
		@Query() query: GetDailyCompletionsRangeDto,
	): Promise<DailyCompletionsRangeResponseDto> {
		this.#logger.debug(
			`친구 일일 완료 현황 조회: friendUserId=${params.userId}, user=${user.userId}, range=${query.startDate}~${query.endDate}`,
		);

		const result = await this.getFriendDailyCompletionsUseCase.execute({
			userId: user.userId,
			friendUserId: params.userId,
			startDate: query.startDate,
			endDate: query.endDate,
		});

		return this.#mapToResponse(result);
	}

	#mapToResponse(result: DailyCompletionsRange): DailyCompletionsRangeResponseDto {
		return {
			completions: result.completions.map((c) => ({
				date: c.date,
				totalTodos: c.totalTodos,
				completedTodos: c.completedTodos,
				isComplete: c.isComplete,
				completionRate: c.completionRate,
				categoryColors: c.categoryColors,
			})),
			totalCompleteDays: result.totalCompleteDays,
			dateRange: {
				startDate: result.dateRange.startDate,
				endDate: result.dateRange.endDate,
			},
		};
	}
}
