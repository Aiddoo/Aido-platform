import { ErrorCode } from "@aido/errors";
import { Body, Controller, Get, Logger, Param, Patch } from "@nestjs/common";
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
import { AiSuggestionService } from "./ai-suggestion.service";
import {
	SuggestionActionDto,
	SuggestionActionResponseDto,
	SuggestionIdParamDto,
	SuggestionListResponseDto,
} from "./dtos";

/**
 * AI 반복 제안 API 컨트롤러
 *
 * AI가 분석한 반복 패턴 제안을 조회하고 수락/거절하는 API입니다.
 *
 * ### 주요 기능
 * - 대기 중인 제안 목록 조회
 * - 제안 수락 (반복 할 일 생성) 또는 거절
 */
@ApiTags(SWAGGER_TAGS.AI)
@ApiBearerAuth()
@Controller("ai/suggestions")
export class AiSuggestionController {
	readonly #logger = new Logger(AiSuggestionController.name);

	constructor(private readonly aiSuggestionService: AiSuggestionService) {}

	/**
	 * GET /ai/suggestions - 대기 중인 제안 목록 조회
	 */
	@Get()
	@ApiDoc({
		summary: "AI 반복 제안 목록 조회",
		operationId: "getAiSuggestions",
		description: `대기 중인(PENDING) AI 반복 제안 목록을 조회합니다.

**응답 필드**
- \`suggestions\`: 제안 배열 (만료되지 않은 PENDING 상태만)`,
	})
	@ApiSuccessResponse({ type: SuggestionListResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiForbiddenError(ErrorCode.AI_1309)
	async getPendingSuggestions(
		@CurrentUser() user: CurrentUserPayload,
	): Promise<SuggestionListResponseDto> {
		this.#logger.debug(`제안 목록 조회: userId=${user.userId}`);

		const suggestions = await this.aiSuggestionService.getPendingSuggestions(
			user.userId,
		);

		return { suggestions };
	}

	/**
	 * PATCH /ai/suggestions/:id - 제안 수락 또는 거절
	 */
	@Patch(":id")
	@ApiDoc({
		summary: "AI 반복 제안 수락/거절",
		operationId: "handleAiSuggestion",
		description: `AI 반복 제안을 수락하거나 거절합니다.

**요청 본문**
- \`action\`: "accept" | "dismiss"
- \`categoryId\`: 수락 시 할 일을 추가할 카테고리 ID (선택)
- \`startDate\`: 반복 시작일 (선택, 기본: 오늘)
- \`endDate\`: 반복 종료일 (선택, 기본: 4주 후)

**수락 시** 반복 할 일이 자동으로 생성됩니다.`,
	})
	@ApiSuccessResponse({ type: SuggestionActionResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiForbiddenError(ErrorCode.AI_1309)
	@ApiNotFoundError(ErrorCode.AI_1305)
	async handleSuggestion(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: SuggestionIdParamDto,
		@Body() body: SuggestionActionDto,
		@Timezone() tz: string,
	): Promise<SuggestionActionResponseDto> {
		this.#logger.debug(
			`제안 액션: id=${params.id}, userId=${user.userId}, action=${body.action}`,
		);

		const result = await this.aiSuggestionService.handleAction(
			user.userId,
			params.id,
			body,
			tz,
		);

		return result;
	}
}
