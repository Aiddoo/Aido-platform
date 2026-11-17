import { ErrorCode } from "@aido/api/errors";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { Timezone } from "#api/platform/http/decorators/timezone.decorator";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiErrorCodesResponse,
  ApiForbiddenError,
  ApiNotFoundError,
  ApiTooManyRequestsError,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";
import { RateLimit } from "#api/platform/throttle/rate-limits";
import { THROTTLED_DESCRIPTION } from "#api/platform/throttle/throttle.constants";

import { AiDataSharingConsentGuard } from "../../../../parsing/ai-assistance-parsing.public.js";
import { HandleSuggestionActionUseCase } from "../../../application/use-cases/handle-suggestion-action.use-case.js";
import { ListPendingSuggestionsUseCase } from "../../../application/use-cases/list-pending-suggestions.use-case.js";
import { RequestSuggestionAnalysisUseCase } from "../../../application/use-cases/request-suggestion-analysis.use-case.js";
import { SuggestionRateLimits } from "../suggestions.rate-limits.js";
import {
  toSuggestionActionResponse,
  toSuggestionAnalysisResponse,
  toSuggestionListResponse,
} from "./ai-suggestion-response.mapper.js";
import {
  SuggestionActionDto,
  SuggestionActionResponseDto,
  SuggestionAnalysisResponseDto,
  SuggestionIdParamDto,
  SuggestionListResponseDto,
} from "./ai-suggestion.dto.js";

const SUGGESTION_LIST_DESCRIPTION = `프리미엄 사용자의 대기 중(PENDING) 제안과 분석 상태(\`analysis\`)를 줍니다.

- 만료되지 않은 제안만 최신순으로 오며, 한 사용자에게 최대 5개입니다. 제안은 만든 뒤 14일에 만료됩니다.
- 사용자 저장 시간대 기준으로 매일 09:00에 자동 분석해 새 제안을 만들고 알림을 보냅니다.
- 근거는 최근 14일의 단건 할 일(반복 할 일 제외)입니다.
- \`evidence\`는 그 기간에 같은 할 일을 적은 횟수와 끝낸 횟수입니다. 띄어쓰기·문장부호·이모지만 다른 제목은 같은 할 일로 셉니다. 1.16.0 전에 만든 제안은 \`null\`입니다.
- 제안이 없으면 \`suggestions\`는 빈 배열입니다.

## analysis.state
위에서부터 먼저 맞는 값 하나입니다. 앱은 이 값으로 카드를 고르고 상태를 다시 계산하지 않습니다.

| 값 | 화면에서 뜻 |
|------|------|
| \`HAS_SUGGESTIONS\` | 대기 중 제안이 있음 |
| \`NEEDS_AI_CONSENT\` | AI 데이터 처리 동의가 필요함 |
| \`NEEDS_MORE_TODOS\` | 최근 14일 단건 할 일이 없음 |
| \`ANALYZING\` | 분석 중 |
| \`DONE_FOR_TODAY\` | 오늘 만든 제안을 모두 정리함 |
| \`NO_PATTERN_FOUND\` | 오늘 분석했지만 반복할 만한 할 일을 못 찾음 |
| \`UNAVAILABLE_TODAY\` | 오늘은 분석하지 못함(AI 사용 불가·비용 한도·실패·멈춤). 다음 자동 분석을 기다림 |
| \`WAITING_FOR_NEXT_RUN\` | 오늘(현지 날짜) 아직 분석하지 않음 |

- 모르는 새 값은 앱 계약이 \`UNKNOWN\`으로 읽습니다.
- \`canRequestNow\`는 \`WAITING_FOR_NEXT_RUN\`일 때만 \`true\`입니다.
- \`nextAnalysisAt\`은 이 사용자에게 다음 자동 분석이 도는 순간입니다. 오늘 분석을 이미 요청했거나(끝남·진행·멈춤) 오늘 09:00이 지났으면 내일 09:00, 아니면 오늘 09:00입니다. 자동 분석은 UTC 매시 정각에 돌아 +5:30·+5:45 같은 시간대는 09:30·09:45입니다.
- \`evidence\`·\`analysis\`는 1.16.0에 더한 칸이고 출시 앱은 읽지 않습니다.`;

const SUGGESTION_ANALYSIS_REQUEST_DESCRIPTION = `오늘(저장 시간대의 현지 날짜) 분석을 큐에 넣고 202와 지금 분석 상태를 줍니다.

- 분석은 사용자당 하루 한 번입니다. 오늘 이미 요청했거나(아침 자동 분석 포함) 기능이 꺼져 있거나 최근 14일 단건 할 일이 없으면 큐에 넣지 않고 202와 지금 상태를 줍니다.
- 날짜는 요청 헤더가 아니라 저장된 시간대로 정합니다. 09:00 전에 요청하면 그날 자동 분석을 대신합니다.
- 앱 안에서 결과를 기다리는 요청이라 푸시·알림함 항목을 만들지 않습니다. 응답의 \`analysis.state\`가 \`ANALYZING\`이면 목록을 다시 조회해 결과를 봅니다.
- 사용자당 1분에 ${SuggestionRateLimits.requestAnalysis.limitPerMinute}회까지입니다.
- 1.13.0 이상 앱은 AI 데이터 처리 동의가 있어야 합니다(AI_1311). 프리미엄이 아니면 AI_1309입니다.`;

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
  readonly #requestSuggestionAnalysisUseCase: RequestSuggestionAnalysisUseCase;

  constructor(
    getPendingSuggestionsUseCase: ListPendingSuggestionsUseCase,
    handleSuggestionActionUseCase: HandleSuggestionActionUseCase,
    requestSuggestionAnalysisUseCase: RequestSuggestionAnalysisUseCase,
  ) {
    this.#getPendingSuggestionsUseCase = getPendingSuggestionsUseCase;
    this.#handleSuggestionActionUseCase = handleSuggestionActionUseCase;
    this.#requestSuggestionAnalysisUseCase = requestSuggestionAnalysisUseCase;
  }

  @Get()
  @ApiDoc({
    summary: "AI 제안 목록과 분석 상태 조회",
    operationId: "getAiSuggestions",
    description: SUGGESTION_LIST_DESCRIPTION,
  })
  @ApiSuccessResponse({ type: SuggestionListResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiForbiddenError(ErrorCode.AI_1309)
  async getPendingSuggestions(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<SuggestionListResponseDto> {
    return toSuggestionListResponse(
      await this.#getPendingSuggestionsUseCase.execute({ userId: user.userId }),
    );
  }

  @Post("analyses")
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(AiDataSharingConsentGuard)
  @RateLimit(SuggestionRateLimits.requestAnalysis)
  @ApiDoc({
    summary: "지금 AI 제안 분석 요청",
    operationId: "requestAiSuggestionAnalysis",
    description: SUGGESTION_ANALYSIS_REQUEST_DESCRIPTION,
  })
  @ApiSuccessResponse({ type: SuggestionAnalysisResponseDto, status: HttpStatus.ACCEPTED })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiErrorCodesResponse(HttpStatus.FORBIDDEN, [ErrorCode.AI_1309, ErrorCode.AI_1311])
  @ApiTooManyRequestsError(ErrorCode.SYS_0001, THROTTLED_DESCRIPTION)
  async requestAnalysis(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<SuggestionAnalysisResponseDto> {
    return toSuggestionAnalysisResponse(
      await this.#requestSuggestionAnalysisUseCase.execute({ userId: user.userId }),
    );
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
