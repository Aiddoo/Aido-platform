import { ErrorCode } from "@aido/api/errors";
import { Controller, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import {
  CurrentUser,
  type CurrentUserPayload,
  Public,
} from "#api/modules/identity/identity-auth-http.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
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
import { IssueMyInviteUseCase } from "../../../application/use-cases/issue-my-invite.use-case.js";
import { PreviewInviteUseCase } from "../../../application/use-cases/preview-invite.use-case.js";
import { RotateInviteCodeUseCase } from "../../../application/use-cases/rotate-invite-code.use-case.js";
import {
  toInviteAvailabilityResponse,
  toInvitePreviewResponse,
  toMyInviteResponse,
} from "./invite-response.mapper.js";
import {
  InviteAvailabilityResponseDto,
  InviteCodeParamDto,
  InvitePreviewResponseDto,
  MyInviteResponseDto,
} from "./invite.dto.js";

const INVITE_THROTTLE = {
  ROTATE: { ttl: 3_600_000, limit: 3 },
  PREVIEW: { ttl: 60_000, limit: 20 },
} as const;

// 정적 경로를 :code보다 먼저 선언해 me·availability가 코드로 해석되지 않게 한다.
// 수락 slice의 me/invitees·:code/redeem은 경로 조각 수가 달라 :code와 겹치지 않는다
@ApiTags(SWAGGER_TAGS.INVITES)
@Controller({ path: "invites", version: API_VERSION.V1 })
export class InviteController {
  readonly #getInviteAvailabilityUseCase: GetInviteAvailabilityUseCase;
  readonly #issueMyInviteUseCase: IssueMyInviteUseCase;
  readonly #rotateInviteCodeUseCase: RotateInviteCodeUseCase;
  readonly #previewInviteUseCase: PreviewInviteUseCase;

  constructor(
    getInviteAvailabilityUseCase: GetInviteAvailabilityUseCase,
    issueMyInviteUseCase: IssueMyInviteUseCase,
    rotateInviteCodeUseCase: RotateInviteCodeUseCase,
    previewInviteUseCase: PreviewInviteUseCase,
  ) {
    this.#getInviteAvailabilityUseCase = getInviteAvailabilityUseCase;
    this.#issueMyInviteUseCase = issueMyInviteUseCase;
    this.#rotateInviteCodeUseCase = rotateInviteCodeUseCase;
    this.#previewInviteUseCase = previewInviteUseCase;
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
    const myInvite = await this.#issueMyInviteUseCase.execute({ inviterId: user.userId });
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
}
