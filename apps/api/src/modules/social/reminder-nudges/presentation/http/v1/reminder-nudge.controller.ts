import { ErrorCode } from "@aido/api/errors";
import { Body, Controller, Get, HttpStatus, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import {
  NudgeCooldownResponseDto,
  toNudgeCooldownResponse,
} from "#api/modules/social/nudges/social-nudges.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { Timezone } from "#api/platform/http/decorators/timezone.decorator";
import { UserIdParamDto } from "#api/platform/http/dtos/user-id-param.dto";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiErrorCodesResponse,
  ApiForbiddenError,
  ApiTooManyRequestsError,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import {
  ApiCreatedSuccessResponse,
  ApiSuccessResponse,
} from "#api/platform/http/swagger/decorators/api-response.decorator";

import { GetReminderNudgeCooldownUseCase } from "../../../application/use-cases/get-reminder-nudge-cooldown.use-case.js";
import { SendReminderNudgeUseCase } from "../../../application/use-cases/send-reminder-nudge.use-case.js";
import { toCreateRemindNudgeResponse } from "./reminder-nudge-response.mapper.js";
import { CreateRemindNudgeResponseDto, SendRemindNudgeDto } from "./reminder-nudge.dto.js";

// 출시 경로(/v1/nudges/remind…)·operationId·DTO component id는 nudges에서 옮기기 전 그대로다
@ApiTags(SWAGGER_TAGS.NUDGES)
@ApiBearerAuth()
@Controller({ path: "nudges", version: API_VERSION.V1 })
export class ReminderNudgeController {
  readonly #sendReminderNudgeUseCase: SendReminderNudgeUseCase;
  readonly #getReminderNudgeCooldownUseCase: GetReminderNudgeCooldownUseCase;

  constructor(
    sendReminderNudgeUseCase: SendReminderNudgeUseCase,
    getReminderNudgeCooldownUseCase: GetReminderNudgeCooldownUseCase,
  ) {
    this.#sendReminderNudgeUseCase = sendReminderNudgeUseCase;
    this.#getReminderNudgeCooldownUseCase = getReminderNudgeCooldownUseCase;
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
    const reminder = await this.#sendReminderNudgeUseCase.execute({
      senderId: user.userId,
      receiverId: dto.receiverId,
      message: dto.message,
      timezone: tz,
    });

    return toCreateRemindNudgeResponse(reminder);
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
    const cooldownInfo = await this.#getReminderNudgeCooldownUseCase.execute({
      senderId: user.userId,
      receiverId: params.userId,
    });

    return toNudgeCooldownResponse(cooldownInfo);
  }
}
