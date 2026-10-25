import { ErrorCode } from "@aido/api/errors";
import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import {
  CurrentUser,
  type CurrentUserPayload,
  Public,
} from "#api/modules/identity/identity-auth-http.public";
import {
  ApiDoc,
  ApiForbiddenError,
  ApiGoneError,
  ApiNotFoundError,
  ApiSuccessResponse,
  ApiTooManyRequestsError,
  ApiUnauthorizedError,
  SWAGGER_TAGS,
} from "#api/platform/http/swagger/index";
import { ThrottleByUser } from "#api/platform/throttle/index";

import { GetInviteAvailability } from "../../../application/use-cases/invites/get-invite-availability.use-case.js";
import { GetInvitedFriends } from "../../../application/use-cases/invites/get-invited-friends.use-case.js";
import { GetMyInvite } from "../../../application/use-cases/invites/get-my-invite.use-case.js";
import { PreviewInvite } from "../../../application/use-cases/invites/preview-invite.use-case.js";
import { RotateInviteCode } from "../../../application/use-cases/invites/rotate-invite-code.use-case.js";
import { InviteMapper } from "../../mappers/invites/invite.mapper.js";
import {
  GetInvitedFriendsQueryDto,
  InviteAvailabilityResponseDto,
  InviteCodeParamDto,
  InvitedFriendsListResponseDto,
  InvitePreviewResponseDto,
  MyInviteResponseDto,
} from "../../schemas/invites/index.js";

const THROTTLED_DESCRIPTION = "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";

// 정적 경로를 :code보다 먼저 선언해 me·availability가 코드로 해석되지 않게 한다
@ApiTags(SWAGGER_TAGS.INVITES)
@Controller("invites")
export class InviteController {
  constructor(
    private readonly getInviteAvailabilityUseCase: GetInviteAvailability,
    private readonly getMyInviteUseCase: GetMyInvite,
    private readonly rotateInviteCodeUseCase: RotateInviteCode,
    private readonly getInvitedFriendsUseCase: GetInvitedFriends,
    private readonly previewInviteUseCase: PreviewInvite,
  ) {}

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
    return this.getInviteAvailabilityUseCase.execute();
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
    const view = await this.getMyInviteUseCase.execute({ inviterId: user.userId });
    return InviteMapper.toMyInviteDto(view);
  }

  @Post("me/rotate")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ThrottleByUser()
  @Throttle({ default: { ttl: 3_600_000, limit: 3 } })
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
    const view = await this.rotateInviteCodeUseCase.execute({ inviterId: user.userId });
    return InviteMapper.toMyInviteDto(view);
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
    const page = await this.getInvitedFriendsUseCase.execute({
      inviterId: user.userId,
      cursor: query.cursor,
      size: query.limit,
      status: query.status,
    });
    return InviteMapper.toInvitedFriendsDto(page);
  }

  @Get(":code")
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiDoc({
    summary: "초대 미리보기",
    operationId: "getInvitePreview",
    description:
      "로그인 없이 초대한 사람의 이름·태그·프로필 이미지만 반환합니다. 공백·하이픈·소문자는 정규화합니다. IP당 분당 20회까지입니다.",
  })
  @ApiSuccessResponse({ type: InvitePreviewResponseDto })
  @ApiNotFoundError(ErrorCode.INVITE_2101)
  @ApiGoneError(ErrorCode.INVITE_2102)
  @ApiForbiddenError(ErrorCode.INVITE_2105)
  @ApiTooManyRequestsError(ErrorCode.SYS_0001, THROTTLED_DESCRIPTION)
  async getPreview(
    @Param({ schema: InviteCodeParamDto }) params: InviteCodeParamDto,
  ): Promise<InvitePreviewResponseDto> {
    const inviter = await this.previewInviteUseCase.execute({ code: params.code });
    return InviteMapper.toPreviewDto(inviter);
  }
}
