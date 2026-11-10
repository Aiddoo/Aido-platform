import { ErrorCode } from "@aido/api/errors";
import { Body, Controller, Get, Header, HttpStatus, Param, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { AppVersion } from "#api/platform/http/request-client/request-client.decorator";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiConflictError,
  ApiErrorCodesResponse,
  ApiNotFoundError,
  ApiTooManyRequestsError,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";
import { THROTTLED_DESCRIPTION } from "#api/platform/throttle/throttle.constants";
import { ThrottleByUser } from "#api/platform/throttle/user-aware-throttler.guard";

import { GetNudgeInteractionAvailabilityUseCase } from "../../../application/use-cases/get-nudge-interaction-availability.use-case.js";
import { GetNudgeInteractionUseCase } from "../../../application/use-cases/get-nudge-interaction.use-case.js";
import { GetNudgeInteractionsUseCase } from "../../../application/use-cases/get-nudge-interactions.use-case.js";
import { GetNudgeThanksPreviewUseCase } from "../../../application/use-cases/get-nudge-thanks-preview.use-case.js";
import { ReplyToNudgeUseCase } from "../../../application/use-cases/reply-to-nudge.use-case.js";
import { SendNudgeThanksUseCase } from "../../../application/use-cases/send-nudge-thanks.use-case.js";
import {
  toNudgeInteractionResponse,
  toNudgeInteractionsResponse,
  toNudgeThanksPreviewResponse,
} from "./nudge-interaction-response.mapper.js";
import {
  GetNudgeInteractionsQueryDto,
  GetNudgeThanksPreviewQueryDto,
  NudgeInteractionAvailabilityResponseDto,
  NudgeInteractionResponseDto,
  NudgeInteractionsResponseDto,
  NudgeThanksPreviewResponseDto,
  NudgeTodoIdParamDto,
  ReplyToNudgeDto,
  SendNudgeThanksDto,
  SendNudgeThanksResponseDto,
} from "./nudge-interaction.dto.js";
import { NudgeIdParamDto } from "./nudge.dto.js";

const NUDGE_INTERACTION_THROTTLE = { ttl: 60_000, limit: 30 } as const;

const APP_VERSION_HEADER = {
  name: "x-app-version",
  required: false,
  description: "설치된 앱 버전. 미전송 시 기존 프로필 아이콘으로 응답합니다.",
} as const;

@ApiTags(SWAGGER_TAGS.NUDGES)
@ApiBearerAuth()
@Controller({ path: "nudges", version: API_VERSION.V1 })
export class NudgeInteractionController {
  readonly #getNudgeInteractionAvailabilityUseCase: GetNudgeInteractionAvailabilityUseCase;
  readonly #getNudgeInteractionsUseCase: GetNudgeInteractionsUseCase;
  readonly #getNudgeInteractionUseCase: GetNudgeInteractionUseCase;
  readonly #getNudgeThanksPreviewUseCase: GetNudgeThanksPreviewUseCase;
  readonly #replyToNudgeUseCase: ReplyToNudgeUseCase;
  readonly #sendNudgeThanksUseCase: SendNudgeThanksUseCase;

  constructor(
    getNudgeInteractionAvailabilityUseCase: GetNudgeInteractionAvailabilityUseCase,
    getNudgeInteractionsUseCase: GetNudgeInteractionsUseCase,
    getNudgeInteractionUseCase: GetNudgeInteractionUseCase,
    getNudgeThanksPreviewUseCase: GetNudgeThanksPreviewUseCase,
    replyToNudgeUseCase: ReplyToNudgeUseCase,
    sendNudgeThanksUseCase: SendNudgeThanksUseCase,
  ) {
    this.#getNudgeInteractionAvailabilityUseCase = getNudgeInteractionAvailabilityUseCase;
    this.#getNudgeInteractionsUseCase = getNudgeInteractionsUseCase;
    this.#getNudgeInteractionUseCase = getNudgeInteractionUseCase;
    this.#getNudgeThanksPreviewUseCase = getNudgeThanksPreviewUseCase;
    this.#replyToNudgeUseCase = replyToNudgeUseCase;
    this.#sendNudgeThanksUseCase = sendNudgeThanksUseCase;
  }

  @Get("interactions/availability")
  @ApiDoc({
    summary: "콕 주고받기 기능 사용 가능 여부",
    operationId: "getNudgeInteractionAvailability",
    description:
      "콕 답장·감사 기능이 켜져 있는지 반환합니다. 꺼져 있으면 앱은 답장·감사 진입점을 숨기고, 아래 콕 답장·감사 API는 NUDGE_1105로 응답합니다.",
  })
  @ApiSuccessResponse({ type: NudgeInteractionAvailabilityResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  getAvailability(): NudgeInteractionAvailabilityResponseDto {
    return this.#getNudgeInteractionAvailabilityUseCase.execute();
  }

  @Get("interactions")
  @Header("Vary", "Origin, X-App-Version")
  @ApiHeader(APP_VERSION_HEADER)
  @ApiDoc({
    summary: "주고받은 콕 목록 조회",
    operationId: "getNudgeInteractions",
    description:
      "받은 콕(received) 또는 보낸 콕(sent)을 커서로 조회합니다. 각 항목의 isAvailable은 지금 답장·감사를 할 수 있는지입니다. 기능이 꺼져 있으면 NUDGE_1105입니다.",
  })
  @ApiSuccessResponse({ type: NudgeInteractionsResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.NUDGE_1105)
  async getInteractions(
    @CurrentUser() user: CurrentUserPayload,
    @Query({ schema: GetNudgeInteractionsQueryDto }) query: GetNudgeInteractionsQueryDto,
    @AppVersion() appVersion?: string,
  ): Promise<NudgeInteractionsResponseDto> {
    const page = await this.#getNudgeInteractionsUseCase.execute({
      userId: user.userId,
      direction: query.direction,
      cursor: query.cursor,
      size: query.limit,
    });
    return toNudgeInteractionsResponse(page, user.userId, appVersion);
  }

  @Get(":id/interaction")
  @Header("Vary", "Origin, X-App-Version")
  @ApiHeader(APP_VERSION_HEADER)
  @ApiDoc({
    summary: "콕 답장·감사 상태 조회",
    operationId: "getNudgeInteraction",
    description:
      "콕 하나의 답장·감사 상태를 조회합니다. 내가 보내거나 받은 콕이 아니거나 기능이 꺼져 있으면 NUDGE_1105입니다.",
  })
  @ApiSuccessResponse({ type: NudgeInteractionResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.NUDGE_1105)
  async getInteraction(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: NudgeIdParamDto }) params: NudgeIdParamDto,
    @AppVersion() appVersion?: string,
  ): Promise<NudgeInteractionResponseDto> {
    const nudge = await this.#getNudgeInteractionUseCase.execute({
      userId: user.userId,
      nudgeId: params.id,
    });
    return toNudgeInteractionResponse(nudge, user.userId, appVersion);
  }

  @Put(":id/reply")
  @ThrottleByUser()
  @Throttle({ default: NUDGE_INTERACTION_THROTTLE })
  @Header("Vary", "Origin, X-App-Version")
  @ApiHeader(APP_VERSION_HEADER)
  @ApiDoc({
    summary: "받은 콕에 답장",
    operationId: "replyToNudge",
    description:
      "첫 답장에만 알림을 보냅니다. 답장을 변경해도 알림을 반복하지 않으며 할 일 완료 상태를 바꾸지 않습니다.",
  })
  @ApiSuccessResponse({ type: NudgeInteractionResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.NUDGE_1105)
  @ApiConflictError(ErrorCode.NUDGE_1109)
  @ApiTooManyRequestsError(ErrorCode.SYS_0001, THROTTLED_DESCRIPTION)
  async reply(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: NudgeIdParamDto }) params: NudgeIdParamDto,
    @Body({ schema: ReplyToNudgeDto }) body: ReplyToNudgeDto,
    @AppVersion() appVersion?: string,
  ): Promise<NudgeInteractionResponseDto> {
    const nudge = await this.#replyToNudgeUseCase.execute({
      userId: user.userId,
      nudgeId: params.id,
      replyKind: body.replyKind,
    });
    return toNudgeInteractionResponse(nudge, user.userId, appVersion);
  }

  @Get("todos/:todoId/thanks")
  @Header("Vary", "Origin, X-App-Version")
  @ApiHeader(APP_VERSION_HEADER)
  @ApiDoc({
    summary: "감사를 받을 친구 미리보기",
    operationId: "getNudgeThanksPreview",
    description:
      "완료한 내 할 일에 콕을 보낸 현재 친구를 미리 봅니다. 할 일이 완료되지 않았으면 NUDGE_1110, 기능이 꺼져 있거나 throughNudgeId가 이 할 일에서 받은 콕이 아니면 NUDGE_1105입니다.",
  })
  @ApiSuccessResponse({ type: NudgeThanksPreviewResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiErrorCodesResponse(HttpStatus.NOT_FOUND, [ErrorCode.TODO_0801, ErrorCode.NUDGE_1105])
  @ApiConflictError(ErrorCode.NUDGE_1110)
  async getThanksPreview(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: NudgeTodoIdParamDto }) params: NudgeTodoIdParamDto,
    @Query({ schema: GetNudgeThanksPreviewQueryDto }) query: GetNudgeThanksPreviewQueryDto,
    @AppVersion() appVersion?: string,
  ): Promise<NudgeThanksPreviewResponseDto> {
    const preview = await this.#getNudgeThanksPreviewUseCase.execute({
      userId: user.userId,
      todoId: params.todoId,
      ...query,
    });
    return toNudgeThanksPreviewResponse(preview, appVersion);
  }

  @Put("todos/:todoId/thanks")
  @ThrottleByUser()
  @Throttle({ default: NUDGE_INTERACTION_THROTTLE })
  @ApiDoc({
    summary: "완료한 할 일의 콕에 감사 전하기",
    operationId: "sendNudgeThanks",
    description:
      "미리보기 시점까지 콕을 보낸 현재 친구에게 감사를 전합니다. 같은 할 일·친구에게 한 번만 보내며 재요청은 성공한 결과 sentCount: 0을 반환합니다.",
  })
  @ApiSuccessResponse({ type: SendNudgeThanksResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiErrorCodesResponse(HttpStatus.NOT_FOUND, [ErrorCode.TODO_0801, ErrorCode.NUDGE_1105])
  @ApiErrorCodesResponse(HttpStatus.CONFLICT, [ErrorCode.NUDGE_1109, ErrorCode.NUDGE_1110])
  @ApiTooManyRequestsError(ErrorCode.SYS_0001, THROTTLED_DESCRIPTION)
  sendThanks(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: NudgeTodoIdParamDto }) params: NudgeTodoIdParamDto,
    @Body({ schema: SendNudgeThanksDto }) body: SendNudgeThanksDto,
  ): Promise<SendNudgeThanksResponseDto> {
    return this.#sendNudgeThanksUseCase.execute({
      userId: user.userId,
      todoId: params.todoId,
      throughNudgeId: body.throughNudgeId,
    });
  }
}
