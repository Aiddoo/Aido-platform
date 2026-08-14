import { ErrorCode } from "@aido/errors";
import { Controller, Get, Logger, Param, Query } from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiHeader,
	ApiParam,
	ApiQuery,
	ApiTags,
} from "@nestjs/swagger";
import { Locale } from "@/shared/presentation/decorators";

import {
	ApiDoc,
	ApiSuccessResponse,
	ApiUnauthorizedError,
	SWAGGER_TAGS,
} from "@/shared/presentation/swagger";

import {
	CurrentUser,
	type CurrentUserPayload,
} from "../../auth/presentation/decorators";
import { GetWeeklyAchievementUseCase } from "../application/queries/get-weekly-achievement/get-weekly-achievement.use-case";
import { GetWeeklyAchievementsUseCase } from "../application/queries/get-weekly-achievements/get-weekly-achievements.use-case";

import {
	GetWeeklyAchievementsQueryDto,
	WeeklyAchievementDetailResponseDto,
	WeeklyAchievementListResponseDto,
	WeeklyAchievementParamDto,
} from "./dtos";

@ApiTags(SWAGGER_TAGS.WEEKLY_ACHIEVEMENTS)
@ApiBearerAuth()
@Controller("weekly-achievements")
export class WeeklyAchievementController {
	readonly #logger = new Logger(WeeklyAchievementController.name);

	constructor(
		private readonly getWeeklyAchievementsUseCase: GetWeeklyAchievementsUseCase,
		private readonly getWeeklyAchievementUseCase: GetWeeklyAchievementUseCase,
	) {}

	@Get()
	@ApiQuery({
		name: "year",
		required: true,
		description: "조회할 연도 (2024-2100)",
		schema: { type: "number", minimum: 2024, maximum: 2100 },
		example: 2026,
	})
	@ApiQuery({
		name: "cursor",
		required: false,
		description:
			"페이지네이션 커서 (다음 페이지 요청 시 이전 응답의 nextCursor 값 사용)",
		schema: { type: "number" },
	})
	@ApiQuery({
		name: "size",
		required: false,
		description: "페이지 크기 (1-200)",
		schema: { type: "number", minimum: 1, maximum: 200, default: 20 },
		example: 20,
	})
	@ApiDoc({
		summary: "주간 달성 현황 목록 조회",
		operationId: "getWeeklyAchievements",
		description: `
## 주간 달성 현황 목록

연도별 주간 할 일 달성 현황을 커서 기반 페이지네이션으로 조회합니다.

### 인증 필요
\`Authorization: Bearer {accessToken}\`

### 요청 예시
\`\`\`
GET /weekly-achievements?year=2026&size=20
GET /weekly-achievements?year=2026&cursor=21&size=20
\`\`\`

### 응답 필드
| 필드 | 타입 | 설명 |
|------|------|------|
| \`items[].weekLabel\` | string | 주차 라벨 (예: 3월 2주차) |
| \`items[].dateRange\` | object | 해당 주의 월~일 날짜 범위 |
| \`items[].completionRate\` | number | 완료율 (0-100%) |
| \`summary.currentStreak\` | number | 현재 연속 달성 주 |
| \`summary.bestStreak\` | number | 최고 연속 달성 기록 |
| \`summary.averageRate\` | number | 평균 완료율 |
		`,
	})
	@ApiSuccessResponse({ type: WeeklyAchievementListResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiHeader({
		name: "Accept-Language",
		description: '응답 텍스트 언어 ("ko" | "en", 미전송 시 ko)',
		required: false,
		example: "ko",
	})
	async getWeeklyAchievements(
		@CurrentUser() user: CurrentUserPayload,
		@Query() query: GetWeeklyAchievementsQueryDto,
		@Locale() locale: "ko" | "en" | undefined,
	): Promise<WeeklyAchievementListResponseDto> {
		this.#logger.debug(
			`주간 달성 목록 조회: user=${user.userId}, year=${query.year}`,
		);

		return this.getWeeklyAchievementsUseCase.execute({
			userId: user.userId,
			year: query.year,
			cursor: query.cursor,
			size: query.size,
			locale: locale ?? "ko",
		});
	}

	@Get(":year/:week")
	@ApiParam({
		name: "year",
		description: "ISO 연도",
		example: 2026,
	})
	@ApiParam({
		name: "week",
		description: "ISO 주차 (1-53)",
		example: 10,
	})
	@ApiDoc({
		summary: "주간 달성 현황 상세 조회",
		operationId: "getWeeklyAchievement",
		description: `
## 주간 달성 현황 상세

특정 연도/주차의 할 일 달성 현황을 조회합니다.

### 인증 필요
\`Authorization: Bearer {accessToken}\`

### 요청 예시
\`\`\`
GET /weekly-achievements/2026/10
\`\`\`
		`,
	})
	@ApiSuccessResponse({ type: WeeklyAchievementDetailResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiHeader({
		name: "Accept-Language",
		description: '응답 텍스트 언어 ("ko" | "en", 미전송 시 ko)',
		required: false,
		example: "ko",
	})
	async getWeeklyAchievement(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: WeeklyAchievementParamDto,
		@Locale() locale: "ko" | "en" | undefined,
	): Promise<WeeklyAchievementDetailResponseDto> {
		this.#logger.debug(
			`주간 달성 상세 조회: user=${user.userId}, year=${params.year}, week=${params.week}`,
		);

		return this.getWeeklyAchievementUseCase.execute({
			userId: user.userId,
			year: params.year,
			week: params.week,
			locale: locale ?? "ko",
		});
	}
}
