import { ErrorCode } from "@aido/api/errors";
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import {
  CurrentUser,
  type CurrentUserPayload,
  Public,
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
  ApiNotFoundError,
  ApiTooManyRequestsError,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";
import { THROTTLED_DESCRIPTION } from "#api/platform/throttle/throttle.constants";
import { ThrottleByUser } from "#api/platform/throttle/user-aware-throttler.guard";

import { GetInviteAvailabilityUseCase } from "../../../application/use-cases/get-invite-availability.use-case.js";
import { GetInvitedFriendsUseCase } from "../../../application/use-cases/get-invited-friends.use-case.js";
import { GetMyInviteUseCase } from "../../../application/use-cases/get-my-invite.use-case.js";
import { PreviewInviteUseCase } from "../../../application/use-cases/preview-invite.use-case.js";
import { RedeemInviteUseCase } from "../../../application/use-cases/redeem-invite.use-case.js";
import { RotateInviteCodeUseCase } from "../../../application/use-cases/rotate-invite-code.use-case.js";
import {
  toInviteAvailabilityResponse,
  toInvitedFriendsListResponse,
  toInvitePreviewResponse,
  toMyInviteResponse,
  toRedeemInviteResponse,
} from "./invite-response.mapper.js";
import {
  GetInvitedFriendsQueryDto,
  InviteAvailabilityResponseDto,
  InviteCodeParamDto,
  InvitedFriendsListResponseDto,
  InvitePreviewResponseDto,
  MyInviteResponseDto,
  RedeemInviteDto,
  RedeemInviteResponseDto,
} from "./invite.dto.js";

const INVITE_THROTTLE = {
  ROTATE: { ttl: 3_600_000, limit: 3 },
  PREVIEW: { ttl: 60_000, limit: 20 },
  REDEEM: { ttl: 60_000, limit: 10 },
} as const;

// 정적 경로를 :code보다 먼저 선언해 me·availability가 코드로 해석되지 않게 한다
@ApiTags(SWAGGER_TAGS.INVITES)
@Controller({ path: "invites", version: API_VERSION.V1 })
export class InviteController {
  readonly #getInviteAvailabilityUseCase: GetInviteAvailabilityUseCase;
  readonly #getMyInviteUseCase: GetMyInviteUseCase;
  readonly #rotateInviteCodeUseCase: RotateInviteCodeUseCase;
  readonly #getInvitedFriendsUseCase: GetInvitedFriendsUseCase;
  readonly #previewInviteUseCase: PreviewInviteUseCase;
  readonly #redeemInviteUseCase: RedeemInviteUseCase;

  constructor(
    getInviteAvailabilityUseCase: GetInviteAvailabilityUseCase,
    getMyInviteUseCase: GetMyInviteUseCase,
    rotateInviteCodeUseCase: RotateInviteCodeUseCase,
    getInvitedFriendsUseCase: GetInvitedFriendsUseCase,
    previewInviteUseCase: PreviewInviteUseCase,
    redeemInviteUseCase: RedeemInviteUseCase,
  ) {
    this.#getInviteAvailabilityUseCase = getInviteAvailabilityUseCase;
    this.#getMyInviteUseCase = getMyInviteUseCase;
    this.#rotateInviteCodeUseCase = rotateInviteCodeUseCase;
    this.#getInvitedFriendsUseCase = getInvitedFriendsUseCase;
    this.#previewInviteUseCase = previewInviteUseCase;
    this.#redeemInviteUseCase = redeemInviteUseCase;
  }

  @Get("availability")
  @Public()
  @ApiDoc({
    summary: "친구 초대 사용 가능 여부",
    operationId: "getInviteAvailability",
    description:
      "INVITE_ENABLED 설정을 반환합니다. 로그인 전 초대 링크 화면도 쓰므로 인증 없이 호출합니다. 꺼져 있으면 앱은 초대 진입점을 숨깁니다.",
  })
  @ApiSuccessResponse({ type: InviteAvailabilityResponseDto })
  getAvailability(): InviteAvailabilityResponseDto {
    return toInviteAvailabilityResponse(this.#getInviteAvailabilityUseCase.execute());
  }

  @Get("me")
  @ApiBearerAuth()
  @ApiDoc({
    summary: "내 초대 코드와 보상 요약",
    operationId: "getMyInvite",
    description:
      "처음 조회하면 초대 코드를 발급하고 이후에는 같은 코드를 반환합니다. 동시에 처음 조회해도 코드는 하나만 만듭니다. 기능이 꺼져 있으면 INVITE_2105입니다.",
  })
  @ApiSuccessResponse({ type: MyInviteResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiForbiddenError(ErrorCode.INVITE_2105)
  async getMyInvite(@CurrentUser() user: CurrentUserPayload): Promise<MyInviteResponseDto> {
    const myInvite = await this.#getMyInviteUseCase.execute({ inviterId: user.userId });
    return toMyInviteResponse(myInvite);
  }

  @Post("me/rotate")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ThrottleByUser()
  @Throttle({ default: INVITE_THROTTLE.ROTATE })
  @ApiDoc({
    summary: "초대 링크 새로 만들기",
    operationId: "rotateInviteCode",
    description:
      "지금 코드를 폐기하고 새 코드를 발급합니다. 폐기한 코드는 다시 발급되지 않고 INVITE_2102가 됩니다. 사용자마다 시간당 3회까지입니다.",
  })
  @ApiSuccessResponse({ type: MyInviteResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiForbiddenError(ErrorCode.INVITE_2105)
  @ApiTooManyRequestsError(ErrorCode.SYS_0001, THROTTLED_DESCRIPTION)
  async rotate(@CurrentUser() user: CurrentUserPayload): Promise<MyInviteResponseDto> {
    const myInvite = await this.#rotateInviteCodeUseCase.execute({ inviterId: user.userId });
    return toMyInviteResponse(myInvite);
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

  @Get(":code")
  @Public()
  @Throttle({ default: INVITE_THROTTLE.PREVIEW })
  @ApiDoc({
    summary: "초대 미리보기",
    operationId: "getInvitePreview",
    description:
      "로그인 없이 초대한 사람의 이름과 프로필 이미지만 반환합니다. 친구 요청에 쓰는 태그는 담지 않습니다. 공백·하이픈·소문자는 정규화합니다. IP당 분당 20회까지입니다.",
  })
  @ApiSuccessResponse({ type: InvitePreviewResponseDto })
  @ApiNotFoundError(ErrorCode.INVITE_2101)
  @ApiGoneError(ErrorCode.INVITE_2102)
  @ApiForbiddenError(ErrorCode.INVITE_2105)
  @ApiTooManyRequestsError(ErrorCode.SYS_0001, THROTTLED_DESCRIPTION)
  async getPreview(
    @Param({ schema: InviteCodeParamDto }) params: InviteCodeParamDto,
  ): Promise<InvitePreviewResponseDto> {
    const inviter = await this.#previewInviteUseCase.execute({ code: params.code });
    return toInvitePreviewResponse(inviter);
  }

  @Post(":code/redeem")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ThrottleByUser()
  @Throttle({ default: INVITE_THROTTLE.REDEEM })
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
    @Param({ schema: InviteCodeParamDto }) params: InviteCodeParamDto,
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
