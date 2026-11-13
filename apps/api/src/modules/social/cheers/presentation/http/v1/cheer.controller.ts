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
  ApiBadRequestError,
  ApiConflictError,
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

import { GetCheerCooldownUseCase } from "../../../application/use-cases/get-cheer-cooldown.use-case.js";
import { GetCheerLimitUseCase } from "../../../application/use-cases/get-cheer-limit.use-case.js";
import { GetReceivedCheersUseCase } from "../../../application/use-cases/get-received-cheers.use-case.js";
import { GetSentCheersUseCase } from "../../../application/use-cases/get-sent-cheers.use-case.js";
import { MarkCheerReadUseCase } from "../../../application/use-cases/mark-cheer-read.use-case.js";
import { MarkManyCheersReadUseCase } from "../../../application/use-cases/mark-many-cheers-read.use-case.js";
import { SendCheerUseCase } from "../../../application/use-cases/send-cheer.use-case.js";
import {
  toCheerCooldownResponse,
  toCheerLimitInfoResponse,
  toCreateCheerResponse,
  toMarkCheerReadResponse,
  toMarkManyCheersReadResponse,
  toReceivedCheersResponse,
  toSentCheersResponse,
} from "./cheer-response.mapper.js";
import {
  CheerCooldownResponseDto,
  CheerIdParamDto,
  CheerLimitInfoDto,
  CreateCheerResponseDto,
  GetCheersQueryDto,
  MarkCheerReadResponseDto,
  MarkCheersReadDto,
  ReceivedCheersResponseDto,
  SendCheerDto,
  SentCheersResponseDto,
} from "./cheer.dto.js";

@ApiTags(SWAGGER_TAGS.CHEERS)
@ApiBearerAuth()
@Controller({ path: "cheers", version: API_VERSION.V1 })
export class CheerController {
  readonly #getReceivedCheersUseCase: GetReceivedCheersUseCase;
  readonly #getSentCheersUseCase: GetSentCheersUseCase;
  readonly #getCheerLimitUseCase: GetCheerLimitUseCase;
  readonly #getCheerCooldownUseCase: GetCheerCooldownUseCase;
  readonly #sendCheerUseCase: SendCheerUseCase;
  readonly #markCheerReadUseCase: MarkCheerReadUseCase;
  readonly #markManyCheersReadUseCase: MarkManyCheersReadUseCase;

  constructor(
    getReceivedCheersUseCase: GetReceivedCheersUseCase,
    getSentCheersUseCase: GetSentCheersUseCase,
    getCheerLimitUseCase: GetCheerLimitUseCase,
    getCheerCooldownUseCase: GetCheerCooldownUseCase,
    sendCheerUseCase: SendCheerUseCase,
    markCheerReadUseCase: MarkCheerReadUseCase,
    markManyCheersReadUseCase: MarkManyCheersReadUseCase,
  ) {
    this.#getReceivedCheersUseCase = getReceivedCheersUseCase;
    this.#getSentCheersUseCase = getSentCheersUseCase;
    this.#getCheerLimitUseCase = getCheerLimitUseCase;
    this.#getCheerCooldownUseCase = getCheerCooldownUseCase;
    this.#sendCheerUseCase = sendCheerUseCase;
    this.#markCheerReadUseCase = markCheerReadUseCase;
    this.#markManyCheersReadUseCase = markManyCheersReadUseCase;
  }

  @Post()
  @ApiHeader({
    name: "X-Timezone",
    required: false,
    description: "사용자 타임존 (IANA, 기본값: UTC)",
    example: "Asia/Seoul",
  })
  @ApiDoc({
    summary: "응원 보내기",
    operationId: "sendCheer",
    description: `친구에게 응원 메시지를 보냅니다.

**요청 필드**
- \`receiverId\` (필수): 응원할 친구 ID
- \`message\` (선택): 응원 메시지 (최대 200자)

**제한**
- FREE: 일 3회, ACTIVE: 무제한
- 동일 친구에게 24시간 쿨다운`,
  })
  @ApiCreatedSuccessResponse({ type: CreateCheerResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiBadRequestError(ErrorCode.CHEER_1204)
  @ApiForbiddenError(ErrorCode.CHEER_1203)
  @ApiConflictError(ErrorCode.CHEER_1201)
  @ApiTooManyRequestsError(ErrorCode.CHEER_1202)
  async sendCheer(
    @CurrentUser() user: CurrentUserPayload,
    @Body({ schema: SendCheerDto }) dto: SendCheerDto,
    @Timezone() tz: string,
  ): Promise<CreateCheerResponseDto> {
    const cheer = await this.#sendCheerUseCase.execute({
      senderId: user.userId,
      receiverId: dto.receiverId,
      message: dto.message,
      timezone: tz,
    });

    return toCreateCheerResponse(cheer);
  }

  @Get("received")
  @Header("Vary", "Origin, X-App-Version")
  @ApiAppVersionHeader()
  @ApiDoc({
    summary: "받은 응원 목록 조회",
    operationId: "getReceivedCheers",
    description: `받은 응원 목록을 커서 기반 페이지네이션으로 조회합니다.

**쿼리 파라미터**
- \`limit\` (기본값: 20): 조회 개수 (1-50)
- \`cursor\`: 페이지네이션 커서`,
  })
  @ApiSuccessResponse({ type: ReceivedCheersResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async getReceivedCheers(
    @CurrentUser() user: CurrentUserPayload,
    @Query({ schema: GetCheersQueryDto }) query: GetCheersQueryDto,
    @AppVersion() appVersion?: string,
  ): Promise<ReceivedCheersResponseDto> {
    const result = await this.#getReceivedCheersUseCase.execute({
      userId: user.userId,
      cursor: query.cursor,
      size: query.limit,
    });

    return toReceivedCheersResponse(result, appVersion);
  }

  @Get("sent")
  @Header("Vary", "Origin, X-App-Version")
  @ApiAppVersionHeader()
  @ApiDoc({
    summary: "보낸 응원 목록 조회",
    operationId: "getSentCheers",
    description: `보낸 응원 목록을 커서 기반 페이지네이션으로 조회합니다.

**쿼리 파라미터**
- \`limit\` (기본값: 20): 조회 개수 (1-50)
- \`cursor\`: 페이지네이션 커서`,
  })
  @ApiSuccessResponse({ type: SentCheersResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async getSentCheers(
    @CurrentUser() user: CurrentUserPayload,
    @Query({ schema: GetCheersQueryDto }) query: GetCheersQueryDto,
    @AppVersion() appVersion?: string,
  ): Promise<SentCheersResponseDto> {
    const result = await this.#getSentCheersUseCase.execute({
      userId: user.userId,
      cursor: query.cursor,
      size: query.limit,
    });

    return toSentCheersResponse(result, appVersion);
  }

  @Get("limit")
  @ApiHeader({
    name: "X-Timezone",
    required: false,
    description: "사용자 타임존 (IANA, 기본값: UTC)",
    example: "Asia/Seoul",
  })
  @ApiDoc({
    summary: "일일 응원 제한 정보 조회",
    operationId: "getCheerLimitInfo",
    description: `오늘 사용한 응원 횟수와 남은 횟수를 확인합니다.

**제한 정책**: FREE 일 3회, ACTIVE 무제한`,
  })
  @ApiSuccessResponse({ type: CheerLimitInfoDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async getLimitInfo(
    @CurrentUser() user: CurrentUserPayload,
    @Timezone() tz: string,
  ): Promise<CheerLimitInfoDto> {
    const limitInfo = await this.#getCheerLimitUseCase.execute({
      userId: user.userId,
      timezone: tz,
    });
    return toCheerLimitInfoResponse(limitInfo);
  }

  @Get("cooldown/:userId")
  @ApiDoc({
    summary: "특정 친구에 대한 쿨다운 상태 조회",
    operationId: "getCheerCooldownInfo",
    description: `특정 친구에게 응원 가능 여부와 남은 쿨다운 시간을 확인합니다.

**쿨다운 정책**: 동일 친구에게 24시간 내 재응원 불가`,
  })
  @ApiSuccessResponse({ type: CheerCooldownResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async getCooldownInfo(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: UserIdParamDto }) params: UserIdParamDto,
  ): Promise<CheerCooldownResponseDto> {
    const cooldownInfo = await this.#getCheerCooldownUseCase.execute({
      senderId: user.userId,
      receiverId: params.userId,
    });

    return toCheerCooldownResponse(params.userId, cooldownInfo);
  }

  @Patch(":id/read")
  @HttpCode(HttpStatus.OK)
  @ApiDoc({
    summary: "응원 읽음 처리",
    operationId: "markCheerAsRead",
    description: `받은 응원을 읽음 상태로 변경합니다.`,
  })
  @ApiSuccessResponse({ type: MarkCheerReadResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.CHEER_1205)
  async markAsRead(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: CheerIdParamDto }) params: CheerIdParamDto,
  ): Promise<MarkCheerReadResponseDto> {
    await this.#markCheerReadUseCase.execute({
      userId: user.userId,
      cheerId: params.id,
    });

    return toMarkCheerReadResponse();
  }

  @Patch("read")
  @HttpCode(HttpStatus.OK)
  @ApiDoc({
    summary: "여러 응원 읽음 처리",
    operationId: "markManyCheersAsRead",
    description: `여러 응원을 한 번에 읽음 상태로 변경합니다.

**요청 필드**
- \`cheerIds\` (필수): 읽음 처리할 응원 ID 배열`,
  })
  @ApiSuccessResponse({ type: MarkCheerReadResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async markManyAsRead(
    @CurrentUser() user: CurrentUserPayload,
    @Body({ schema: MarkCheersReadDto }) dto: MarkCheersReadDto,
  ): Promise<MarkCheerReadResponseDto> {
    const count = await this.#markManyCheersReadUseCase.execute({
      userId: user.userId,
      cheerIds: dto.cheerIds,
    });

    return toMarkManyCheersReadResponse(count);
  }
}
