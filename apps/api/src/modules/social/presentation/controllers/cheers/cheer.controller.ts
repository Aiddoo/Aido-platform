import { ErrorCode } from "@aido/api/errors";
import {
  Header,
  Headers,
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
import { ApiBearerAuth, ApiHeader, ApiParam, ApiTags } from "@nestjs/swagger";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { Timezone } from "#api/platform/http/decorators/index";
import {
  ApiBadRequestError,
  ApiConflictError,
  ApiCreatedResponse,
  ApiDoc,
  ApiForbiddenError,
  ApiNotFoundError,
  ApiSuccessResponse,
  ApiTooManyRequestsError,
  ApiUnauthorizedError,
  SWAGGER_TAGS,
} from "#api/platform/http/swagger/index";
import { toISOStringOrNull } from "#api/shared/domain/date/utils/format";

import { GetCheerCooldown } from "../../../application/use-cases/cheers/get-cheer-cooldown.use-case.js";
import { GetCheerLimit } from "../../../application/use-cases/cheers/get-cheer-limit.use-case.js";
import { GetReceivedCheers } from "../../../application/use-cases/cheers/get-received-cheers.use-case.js";
import { GetSentCheers } from "../../../application/use-cases/cheers/get-sent-cheers.use-case.js";
import { MarkCheerRead } from "../../../application/use-cases/cheers/mark-cheer-read.use-case.js";
import { MarkManyCheersRead } from "../../../application/use-cases/cheers/mark-many-cheers-read.use-case.js";
import { SendCheer } from "../../../application/use-cases/cheers/send-cheer.use-case.js";
import { CheerMapper } from "../../mappers/cheers/cheer.mapper.js";
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
} from "../../schemas/cheers/index.js";

@ApiTags(SWAGGER_TAGS.CHEERS)
@ApiBearerAuth()
@Controller("cheers")
export class CheerController {
  constructor(
    private readonly getReceivedCheersUseCase: GetReceivedCheers,
    private readonly getSentCheersUseCase: GetSentCheers,
    private readonly getCheerLimitUseCase: GetCheerLimit,
    private readonly getCheerCooldownUseCase: GetCheerCooldown,
    private readonly sendCheerUseCase: SendCheer,
    private readonly markCheerReadUseCase: MarkCheerRead,
    private readonly markManyCheersReadUseCase: MarkManyCheersRead,
  ) {}

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
  @ApiCreatedResponse({ type: CreateCheerResponseDto })
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
    const cheer = await this.sendCheerUseCase.execute({
      senderId: user.userId,
      receiverId: dto.receiverId,
      message: dto.message,
      timezone: tz,
    });

    return {
      message: "응원을 보냈어요! 🎉",
      cheer: CheerMapper.toDto(cheer),
    };
  }

  @Header("Vary", "Origin, X-App-Version")
  @ApiHeader({
    name: "x-app-version",
    required: false,
    description: "설치된 앱 버전. 미전송 시 기존 프로필 아이콘으로 응답합니다.",
  })
  @Get("received")
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

    @Headers("x-app-version") appVersion?: string,
  ): Promise<ReceivedCheersResponseDto> {
    const result = await this.getReceivedCheersUseCase.execute({
      userId: user.userId,
      cursor: query.cursor,
      size: query.limit,
    });

    return {
      cheers: CheerMapper.toDetailDtoList(result.items, appVersion),
      totalCount: result.totalCount,
      unreadCount: result.unreadCount,
      hasMore: result.hasMore,
    };
  }

  @Header("Vary", "Origin, X-App-Version")
  @ApiHeader({
    name: "x-app-version",
    required: false,
    description: "설치된 앱 버전. 미전송 시 기존 프로필 아이콘으로 응답합니다.",
  })
  @Get("sent")
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

    @Headers("x-app-version") appVersion?: string,
  ): Promise<SentCheersResponseDto> {
    const result = await this.getSentCheersUseCase.execute({
      userId: user.userId,
      cursor: query.cursor,
      size: query.limit,
    });

    return {
      cheers: CheerMapper.toDetailDtoList(result.items, appVersion),
      totalCount: result.totalCount,
      hasMore: result.hasMore,
    };
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
    const limitInfo = await this.getCheerLimitUseCase.execute({
      userId: user.userId,
      timezone: tz,
    });
    return CheerMapper.toLimitInfoDto(limitInfo);
  }

  @Get("cooldown/:userId")
  @ApiParam({
    name: "userId",
    description: "쿨다운 상태를 확인할 친구의 ID (CUID 25자, 예: clz7x5p8k0005qz0z8z8z8z8z)",
    example: "clz7x5p8k0005qz0z8z8z8z8z",
  })
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
    @Param("userId") targetUserId: string,
  ): Promise<CheerCooldownResponseDto> {
    const cooldownInfo = await this.getCheerCooldownUseCase.execute({
      senderId: user.userId,
      receiverId: targetUserId,
    });

    return {
      userId: targetUserId,
      canCheer: !cooldownInfo.isActive,
      remainingSeconds: cooldownInfo.remainingSeconds,
      cooldownEndsAt: toISOStringOrNull(cooldownInfo.canCheerAt ?? null),
    };
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
    await this.markCheerReadUseCase.execute({
      userId: user.userId,
      cheerId: params.id,
    });

    return {
      message: "확인했습니다.",
      readCount: 1,
    };
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
    const count = await this.markManyCheersReadUseCase.execute({
      userId: user.userId,
      cheerIds: dto.cheerIds,
    });

    return {
      message: `${count}개의 응원을 확인했습니다.`,
      readCount: count,
    };
  }
}
