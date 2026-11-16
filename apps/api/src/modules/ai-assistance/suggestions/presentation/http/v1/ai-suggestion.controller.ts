import { ErrorCode } from "@aido/api/errors";
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
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

import { HandleSuggestionActionUseCase } from "../../../application/use-cases/handle-suggestion-action.use-case.js";
import { ListPendingSuggestionsUseCase } from "../../../application/use-cases/list-pending-suggestions.use-case.js";
import {
  toSuggestionActionResponse,
  toSuggestionResponse,
} from "./ai-suggestion-response.mapper.js";
import {
  SuggestionActionDto,
  SuggestionActionResponseDto,
  SuggestionIdParamDto,
  SuggestionListResponseDto,
} from "./ai-suggestion.dto.js";

const SUGGESTION_LIST_DESCRIPTION = `프리미엄 사용자의 대기 중(PENDING) 제안을 최신순으로 줍니다.

- 만료되지 않은 제안만 오며, 한 사용자에게 최대 5개입니다. 제안은 만든 뒤 14일에 만료됩니다.
- 사용자 저장 시간대 기준으로 매일 09:00에 자동 분석해 새 제안을 만들고 알림을 보냅니다(광고성 알림이라 야간 21~08시를 피합니다).
- 근거는 최근 14일의 단건 할 일(반복 할 일 제외)입니다.
- 제안이 없으면 \`suggestions\`는 빈 배열입니다.`;

const SUGGESTION_ACTION_DESCRIPTION = `제안을 수락하거나 거절합니다.

## 요청 본문
| 필드 | 필수 | 설명 |
|------|------|------|
| \`action\` | O | \`accept\` 또는 \`dismiss\` |
| \`categoryId\` | accept일 때 | 반복 할 일을 만들 카테고리. 없으면 400(SYS_0002) |
| \`startDate\` | X | 반복 시작일(YYYY-MM-DD). 기본은 사용자 현지 오늘 |
| \`endDate\` | X | 반복 종료일(YYYY-MM-DD). 기본은 시작 기준 4주 뒤 |

## 동작
- \`accept\`: 제안의 요일마다 매주 반복하는 할 일을 만들고 \`createdTodosCount\`에 만든 개수를 줍니다. 제안은 \`ACCEPTED\`가 됩니다.
- \`dismiss\`: 제안이 \`DISMISSED\`가 되어 목록에서 사라집니다.
- 기본 날짜의 "오늘"은 \`X-Timezone\`, 없으면 저장된 사용자 시간대 기준입니다.

## 오류
| 코드 | 상태 | 상황 |
|------|------|------|
| AI_1305 | 404 | 제안이 없거나 내 제안이 아님 |
| AI_1306 | 409 | 이미 처리한 제안 |
| AI_1307 | 410 | 만료된 제안 |
| AI_1309 | 403 | 프리미엄이 아님 |`;

@ApiTags(SWAGGER_TAGS.AI)
@ApiBearerAuth()
@Controller({ path: "ai/suggestions", version: API_VERSION.V1 })
export class AiSuggestionController {
  readonly #getPendingSuggestionsUseCase: ListPendingSuggestionsUseCase;
  readonly #handleSuggestionActionUseCase: HandleSuggestionActionUseCase;

  constructor(
    getPendingSuggestionsUseCase: ListPendingSuggestionsUseCase,
    handleSuggestionActionUseCase: HandleSuggestionActionUseCase,
  ) {
    this.#getPendingSuggestionsUseCase = getPendingSuggestionsUseCase;
    this.#handleSuggestionActionUseCase = handleSuggestionActionUseCase;
  }

  @Get()
  @ApiDoc({
    summary: "AI 제안 목록 조회",
    operationId: "getAiSuggestions",
    description: SUGGESTION_LIST_DESCRIPTION,
  })
  @ApiSuccessResponse({ type: SuggestionListResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiForbiddenError(ErrorCode.AI_1309)
  async getPendingSuggestions(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<SuggestionListResponseDto> {
    const suggestions = await this.#getPendingSuggestionsUseCase.execute({ userId: user.userId });

    return { suggestions: suggestions.map(toSuggestionResponse) };
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  @ApiDoc({
    summary: "AI 제안 수락/거절",
    operationId: "handleAiSuggestion",
    description: SUGGESTION_ACTION_DESCRIPTION,
  })
  @ApiSuccessResponse({ type: SuggestionActionResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiForbiddenError(ErrorCode.AI_1309)
  @ApiNotFoundError(ErrorCode.AI_1305)
  async handleSuggestion(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: SuggestionIdParamDto }) params: SuggestionIdParamDto,
    @Body({ schema: SuggestionActionDto }) body: SuggestionActionDto,
    @Timezone({ preserveIfMissing: true }) tz: string | undefined,
  ): Promise<SuggestionActionResponseDto> {
    const result = await this.#handleSuggestionActionUseCase.execute({
      userId: user.userId,
      suggestionId: params.id,
      action: body.action,
      categoryId: body.categoryId,
      startDate: body.startDate,
      endDate: body.endDate,
      timezone: tz,
    });

    return toSuggestionActionResponse(result);
  }
}
