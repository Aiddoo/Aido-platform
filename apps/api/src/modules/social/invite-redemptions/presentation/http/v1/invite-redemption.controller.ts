import { ErrorCode } from "@aido/api/errors";
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { Timezone } from "#api/platform/http/decorators/timezone.decorator";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiBadRequestError,
  ApiConflictError,
  ApiErrorCodesResponse,
  ApiForbiddenError,
  ApiGoneError,
  ApiTooManyRequestsError,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";
import { THROTTLED_DESCRIPTION } from "#api/platform/throttle/throttle.constants";
import { ThrottleByUser } from "#api/platform/throttle/user-aware-throttler.guard";

import { GetInvitedFriendsUseCase } from "../../../application/use-cases/get-invited-friends.use-case.js";
import { RedeemInviteUseCase } from "../../../application/use-cases/redeem-invite.use-case.js";
import {
  toInvitedFriendsListResponse,
  toRedeemInviteResponse,
} from "./invite-redemption-response.mapper.js";
import {
  GetInvitedFriendsQueryDto,
  InvitedFriendsListResponseDto,
  RedeemInviteCodeParamDto,
  RedeemInviteDto,
  RedeemInviteResponseDto,
} from "./invite-redemption.dto.js";

const INVITE_REDEEM_THROTTLE = { ttl: 60_000, limit: 10 } as const;

// 경로는 초대 코드 slice와 같은 /invites다. me/invitees·:code/redeem은 경로 조각이 둘이라 :code와 겹치지 않는다
@ApiTags(SWAGGER_TAGS.INVITES)
@Controller({ path: "invites", version: API_VERSION.V1 })
export class InviteRedemptionController {
  readonly #getInvitedFriendsUseCase: GetInvitedFriendsUseCase;
  readonly #redeemInviteUseCase: RedeemInviteUseCase;

  constructor(
    getInvitedFriendsUseCase: GetInvitedFriendsUseCase,
    redeemInviteUseCase: RedeemInviteUseCase,
  ) {
    this.#getInvitedFriendsUseCase = getInvitedFriendsUseCase;
    this.#redeemInviteUseCase = redeemInviteUseCase;
  }

  @Get("me/invitees")
  @ApiBearerAuth()
  @ApiDoc({
    summary: "내가 초대한 친구 목록",
    operationId: "getInvitedFriends",
    description:
      "초대 수락 시각 내림차순입니다. cursor는 이전 페이지 마지막 userId입니다. status를 주면 그 상태만 반환하고 totalCount도 그 상태의 수입니다. 기능이 꺼져 있으면 INVITE_2105입니다.",
  })
  @ApiSuccessResponse({ type: InvitedFriendsListResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiForbiddenError(ErrorCode.INVITE_2105)
  async getInvitedFriends(
    @CurrentUser() user: CurrentUserPayload,
    @Query({ schema: GetInvitedFriendsQueryDto }) query: GetInvitedFriendsQueryDto,
  ): Promise<InvitedFriendsListResponseDto> {
    const page = await this.#getInvitedFriendsUseCase.execute({
      inviterId: user.userId,
      cursor: query.cursor,
      size: query.limit,
      status: query.status,
    });
    return toInvitedFriendsListResponse(page);
  }

  @Post(":code/redeem")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ThrottleByUser()
  @Throttle({ default: INVITE_REDEEM_THROTTLE })
  @ApiHeader({
    name: "X-Timezone",
    required: false,
    description: "사용자 타임존 (IANA, 기본값: UTC). 초대 사용 시작일을 정하는 날짜 기준입니다.",
    example: "Asia/Seoul",
  })
  @ApiDoc({
    summary: "초대 수락",
    operationId: "redeemInvite",
    description: `초대한 사람과 친구를 맺습니다. 결과는 outcome으로 구분합니다.

- REDEEMED: 가입 7일 안의 새 사용자. 같은 기기·같은 신원으로 처음이면 보상을 받습니다.
- CONNECTED: 기존 사용자. 보상 없이 친구를 맺습니다.
- ALREADY_FRIENDS: 이미 친구라 바뀐 것이 없습니다.

초대한 사람의 친구 자리가 꽉 차 있으면 friendship은 REQUESTED입니다. 다시 요청해도 수락 기록은 한 번만 남습니다. 사용 시작을 세는 날짜는 수락할 때의 X-Timezone으로 고정합니다. 사용자마다 분당 10회까지입니다. 기능이 꺼져 있으면 INVITE_2105입니다.`,
  })
  @ApiSuccessResponse({ type: RedeemInviteResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiErrorCodesResponse(HttpStatus.NOT_FOUND, [ErrorCode.INVITE_2101, ErrorCode.USER_0601])
  @ApiGoneError(ErrorCode.INVITE_2102)
  @ApiBadRequestError(ErrorCode.INVITE_2103)
  @ApiConflictError(ErrorCode.INVITE_2104)
  @ApiErrorCodesResponse(HttpStatus.FORBIDDEN, [
    ErrorCode.INVITE_2105,
    ErrorCode.INVITE_2106,
    ErrorCode.BLOCK_2204,
  ])
  @ApiTooManyRequestsError(ErrorCode.SYS_0001, THROTTLED_DESCRIPTION)
  async redeem(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: RedeemInviteCodeParamDto }) params: RedeemInviteCodeParamDto,
    @Body({ schema: RedeemInviteDto }) body: RedeemInviteDto,
    @Timezone() timezone: string,
  ): Promise<RedeemInviteResponseDto> {
    const result = await this.#redeemInviteUseCase.execute({
      inviteeId: user.userId,
      code: params.code,
      installationId: body.installationId,
      timezone,
    });
    return toRedeemInviteResponse(result);
  }
}
