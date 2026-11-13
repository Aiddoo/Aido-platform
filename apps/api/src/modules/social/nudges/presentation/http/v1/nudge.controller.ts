import { ErrorCode } from "@aido/api/errors";
import {
  Header,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { Timezone } from "#api/platform/http/decorators/timezone.decorator";
import { UserIdParamDto } from "#api/platform/http/dtos/user-id-param.dto";
import { AppVersion } from "#api/platform/http/request-client/request-client.decorator";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiConflictError,
  ApiErrorCodesResponse,
  ApiForbiddenError,
  ApiNotFoundError,
  ApiTooManyRequestsError,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiAppVersionHeader } from "#api/platform/http/swagger/decorators/api-header.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import {
  ApiCreatedSuccessResponse,
  ApiSuccessResponse,
} from "#api/platform/http/swagger/decorators/api-response.decorator";

import { GetNudgeCooldownUseCase } from "../../../application/use-cases/get-nudge-cooldown.use-case.js";
import { GetNudgeLimitUseCase } from "../../../application/use-cases/get-nudge-limit.use-case.js";
import { GetReceivedNudgesUseCase } from "../../../application/use-cases/get-received-nudges.use-case.js";
import { GetRemindNudgeCooldownUseCase } from "../../../application/use-cases/get-remind-nudge-cooldown.use-case.js";
import { GetSentNudgesUseCase } from "../../../application/use-cases/get-sent-nudges.use-case.js";
import { MarkNudgeReadUseCase } from "../../../application/use-cases/mark-nudge-read.use-case.js";
import { SendNudgeUseCase } from "../../../application/use-cases/send-nudge.use-case.js";
import { SendRemindNudgeUseCase } from "../../../application/use-cases/send-remind-nudge.use-case.js";
import {
  toCreateNudgeResponse,
  toCreateRemindNudgeResponse,
  toMarkNudgeReadResponse,
  toNudgeCooldownResponse,
  toNudgeLimitInfoResponse,
  toReceivedNudgesResponse,
  toSentNudgesResponse,
} from "./nudge-response.mapper.js";
import {
  CreateNudgeResponseDto,
  CreateRemindNudgeResponseDto,
  GetNudgesQueryDto,
  MarkNudgeReadResponseDto,
  NudgeCooldownResponseDto,
  NudgeIdParamDto,
  NudgeLimitInfoDto,
  ReceivedNudgesResponseDto,
  SendNudgeDto,
  SendRemindNudgeDto,
  SentNudgesResponseDto,
} from "./nudge.dto.js";

@ApiTags(SWAGGER_TAGS.NUDGES)
@ApiBearerAuth()
@Controller({ path: "nudges", version: API_VERSION.V1 })
export class NudgeController {
  readonly #getReceivedNudgesUseCase: GetReceivedNudgesUseCase;
  readonly #getSentNudgesUseCase: GetSentNudgesUseCase;
  readonly #getNudgeLimitUseCase: GetNudgeLimitUseCase;
  readonly #getNudgeCooldownUseCase: GetNudgeCooldownUseCase;
  readonly #getRemindNudgeCooldownUseCase: GetRemindNudgeCooldownUseCase;
  readonly #sendNudgeUseCase: SendNudgeUseCase;
  readonly #sendRemindNudgeUseCase: SendRemindNudgeUseCase;
  readonly #markNudgeReadUseCase: MarkNudgeReadUseCase;

  constructor(
    getReceivedNudgesUseCase: GetReceivedNudgesUseCase,
    getSentNudgesUseCase: GetSentNudgesUseCase,
    getNudgeLimitUseCase: GetNudgeLimitUseCase,
    getNudgeCooldownUseCase: GetNudgeCooldownUseCase,
    getRemindNudgeCooldownUseCase: GetRemindNudgeCooldownUseCase,
    sendNudgeUseCase: SendNudgeUseCase,
    sendRemindNudgeUseCase: SendRemindNudgeUseCase,
    markNudgeReadUseCase: MarkNudgeReadUseCase,
  ) {
    this.#getReceivedNudgesUseCase = getReceivedNudgesUseCase;
    this.#getSentNudgesUseCase = getSentNudgesUseCase;
    this.#getNudgeLimitUseCase = getNudgeLimitUseCase;
    this.#getNudgeCooldownUseCase = getNudgeCooldownUseCase;
    this.#getRemindNudgeCooldownUseCase = getRemindNudgeCooldownUseCase;
    this.#sendNudgeUseCase = sendNudgeUseCase;
    this.#sendRemindNudgeUseCase = sendRemindNudgeUseCase;
    this.#markNudgeReadUseCase = markNudgeReadUseCase;
  }

  @Post()
  @ApiHeader({
    name: "X-Timezone",
    required: false,
    description: "사용자 타임존 (IANA, 기본값: UTC)",
    example: "Asia/Seoul",
  })
  @ApiDoc({
    summary: "콕 찌르기",
    operationId: "sendNudge",
    description: `친구의 할 일을 콕 찌릅니다.

**요청 필드**
- \`receiverId\` (필수): 콕 찌를 친구 ID
- \`todoId\` (필수): 찔러줄 할 일 ID
- \`message\` (선택): 메시지 (최대 200자)

**제한**
- 오늘의 할 일에만 콕 찌르기 가능
- FREE: 일 3회, ACTIVE: 무제한
- 동일 Todo에 24시간 쿨다운`,
  })
  @ApiCreatedSuccessResponse({ type: CreateNudgeResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiErrorCodesResponse(HttpStatus.BAD_REQUEST, [ErrorCode.NUDGE_1104, ErrorCode.NUDGE_1106])
  @ApiForbiddenError(ErrorCode.NUDGE_1103)
  @ApiNotFoundError(ErrorCode.TODO_0801)
  @ApiConflictError(ErrorCode.NUDGE_1101)
  @ApiTooManyRequestsError(ErrorCode.NUDGE_1102)
  async sendNudge(
    @CurrentUser() user: CurrentUserPayload,
    @Body({ schema: SendNudgeDto }) dto: SendNudgeDto,
    @Timezone() tz: string,
  ): Promise<CreateNudgeResponseDto> {
    const nudge = await this.#sendNudgeUseCase.execute({
      senderId: user.userId,
      receiverId: dto.receiverId,
      todoId: dto.todoId,
      message: dto.message,
      timezone: tz,
    });

    return toCreateNudgeResponse(nudge);
  }

  @Get("received")
  @Header("Vary", "Origin, X-App-Version")
  @ApiAppVersionHeader()
  @ApiDoc({
    summary: "받은 콕 찌름 목록 조회",
    operationId: "getReceivedNudges",
    description: `받은 콕 찌름 목록을 커서 기반 페이지네이션으로 조회합니다.

**쿼리 파라미터**
- \`limit\` (기본값: 20): 조회 개수 (1-50)
- \`cursor\`: 페이지네이션 커서`,
  })
  @ApiSuccessResponse({ type: ReceivedNudgesResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async getReceivedNudges(
    @CurrentUser() user: CurrentUserPayload,
    @Query({ schema: GetNudgesQueryDto }) query: GetNudgesQueryDto,
    @AppVersion() appVersion?: string,
  ): Promise<ReceivedNudgesResponseDto> {
    const result = await this.#getReceivedNudgesUseCase.execute({
      userId: user.userId,
      cursor: query.cursor,
      size: query.limit,
    });

    return toReceivedNudgesResponse(result, appVersion);
  }

  @Get("sent")
  @Header("Vary", "Origin, X-App-Version")
  @ApiAppVersionHeader()
  @ApiDoc({
    summary: "보낸 콕 찌름 목록 조회",
    operationId: "getSentNudges",
    description: `보낸 콕 찌름 목록을 커서 기반 페이지네이션으로 조회합니다.

**쿼리 파라미터**
- \`limit\` (기본값: 20): 조회 개수 (1-50)
- \`cursor\`: 페이지네이션 커서`,
  })
  @ApiSuccessResponse({ type: SentNudgesResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async getSentNudges(
    @CurrentUser() user: CurrentUserPayload,
    @Query({ schema: GetNudgesQueryDto }) query: GetNudgesQueryDto,
    @AppVersion() appVersion?: string,
  ): Promise<SentNudgesResponseDto> {
    const result = await this.#getSentNudgesUseCase.execute({
      userId: user.userId,
      cursor: query.cursor,
      size: query.limit,
    });

    return toSentNudgesResponse(result, appVersion);
  }

  @Get("limit")
  @ApiHeader({
    name: "X-Timezone",
    required: false,
    description: "사용자 타임존 (IANA, 기본값: UTC)",
    example: "Asia/Seoul",
  })
  @ApiDoc({
    summary: "일일 콕 찌르기 제한 정보 조회",
    operationId: "getNudgeLimitInfo",
    description: `오늘 사용한 콕 찌르기 횟수와 남은 횟수를 확인합니다.

**제한 정책**: FREE 일 3회, ACTIVE 무제한`,
  })
  @ApiSuccessResponse({ type: NudgeLimitInfoDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async getLimitInfo(
    @CurrentUser() user: CurrentUserPayload,
    @Timezone() tz: string,
  ): Promise<NudgeLimitInfoDto> {
    const limitInfo = await this.#getNudgeLimitUseCase.execute({
      userId: user.userId,
      timezone: tz,
    });

    return toNudgeLimitInfoResponse(limitInfo);
  }

  @Get("cooldown/:userId")
  @ApiDoc({
    summary: "특정 친구에 대한 쿨다운 상태 조회",
    operationId: "getNudgeCooldownInfo",
    description: `특정 친구에게 가장 최근 보낸 콕 찌르기 기준 쿨다운 상태를 확인합니다.
실제 콕 찌르기는 동일 Todo 단위로 24시간 쿨다운이 적용됩니다.

**쿨다운 정책**: 동일 Todo에 24시간 내 다시 콕 찌르기 불가`,
  })
  @ApiSuccessResponse({ type: NudgeCooldownResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async getCooldownInfo(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: UserIdParamDto }) params: UserIdParamDto,
  ): Promise<NudgeCooldownResponseDto> {
    const cooldownInfo = await this.#getNudgeCooldownUseCase.execute({
      senderId: user.userId,
      receiverId: params.userId,
    });

    return toNudgeCooldownResponse(cooldownInfo);
  }

  @Post("remind")
  @ApiHeader({
    name: "X-Timezone",
    required: false,
    description: "사용자 타임존 (IANA, 기본값: UTC)",
    example: "Asia/Seoul",
  })
  @ApiDoc({
    summary: "리마인드 콕 찌르기",
    operationId: "sendRemindNudge",
    description: `친구가 오늘 할일을 만들지 않았을 때 독촉 콕 찌르기를 보냅니다.

**요청 필드**
- \`receiverId\` (필수): 콕 찌를 친구 ID
- \`message\` (선택): 독촉 메시지 (최대 200자)

**제한**
- 친구가 오늘 할일이 있으면 전송 불가
- 같은 친구에게 1시간 쿨다운
- 일일 제한 없음`,
  })
  @ApiCreatedSuccessResponse({ type: CreateRemindNudgeResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiErrorCodesResponse(HttpStatus.BAD_REQUEST, [ErrorCode.NUDGE_1104, ErrorCode.NUDGE_1107])
  @ApiForbiddenError(ErrorCode.NUDGE_1103)
  @ApiTooManyRequestsError(ErrorCode.NUDGE_1108)
  async sendRemindNudge(
    @CurrentUser() user: CurrentUserPayload,
    @Body({ schema: SendRemindNudgeDto }) dto: SendRemindNudgeDto,
    @Timezone() tz: string,
  ): Promise<CreateRemindNudgeResponseDto> {
    const remindNudge = await this.#sendRemindNudgeUseCase.execute({
      senderId: user.userId,
      receiverId: dto.receiverId,
      message: dto.message,
      timezone: tz,
    });

    return toCreateRemindNudgeResponse(remindNudge);
  }

  @Get("remind/cooldown/:userId")
  @ApiDoc({
    summary: "리마인드 콕 찌르기 쿨다운 상태 조회",
    operationId: "getRemindNudgeCooldownInfo",
    description: `특정 친구에게 리마인드 콕 찌르기 가능 여부와 남은 쿨다운 시간을 확인합니다.

**쿨다운 정책**: 동일 친구에게 1시간 내 재전송 불가`,
  })
  @ApiSuccessResponse({ type: NudgeCooldownResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async getRemindCooldownInfo(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: UserIdParamDto }) params: UserIdParamDto,
  ): Promise<NudgeCooldownResponseDto> {
    const cooldownInfo = await this.#getRemindNudgeCooldownUseCase.execute({
      senderId: user.userId,
      receiverId: params.userId,
    });

    return toNudgeCooldownResponse(cooldownInfo);
  }

  @Patch(":id/read")
  @HttpCode(HttpStatus.OK)
  @ApiDoc({
    summary: "콕 찌름 읽음 처리",
    operationId: "markNudgeAsRead",
    description: `받은 콕 찌름을 읽음 상태로 변경합니다.`,
  })
  @ApiSuccessResponse({ type: MarkNudgeReadResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.NUDGE_1105)
  async markAsRead(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: NudgeIdParamDto }) params: NudgeIdParamDto,
  ): Promise<MarkNudgeReadResponseDto> {
    await this.#markNudgeReadUseCase.execute({
      userId: user.userId,
      nudgeId: params.id,
    });

    return toMarkNudgeReadResponse();
  }
}
