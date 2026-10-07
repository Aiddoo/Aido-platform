import { ErrorCode } from "@aido/api/errors";
import { Body, Controller, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import {
  Admin,
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import {
  ApiBadRequestError,
  ApiCreatedResponse,
  ApiDoc,
  ApiForbiddenError,
  ApiNotFoundError,
  SWAGGER_TAGS,
} from "#api/platform/http/swagger/index";

import { BroadcastNotification } from "../../../application/use-cases/admin/broadcast-notification.use-case.js";
import { SendTargetedNotification } from "../../../application/use-cases/admin/send-targeted-notification.use-case.js";
import {
  BroadcastNotificationDto,
  BroadcastResultDto,
  TargetedNotificationDto,
} from "../../schemas/admin/index.js";

@ApiTags(SWAGGER_TAGS.ADMIN_NOTIFICATIONS)
@ApiBearerAuth()
@Controller("admin/notifications")
export class AdminController {
  readonly #broadcastNotification: Pick<BroadcastNotification, "execute">;
  readonly #sendTargetedNotification: Pick<SendTargetedNotification, "execute">;

  constructor(
    broadcastNotification: BroadcastNotification,
    sendTargetedNotification: SendTargetedNotification,
  ) {
    this.#broadcastNotification = broadcastNotification;
    this.#sendTargetedNotification = sendTargetedNotification;
  }

  @Post("broadcast")
  @Admin()
  @ApiDoc({
    summary: "전체/조건부 알림 발송",
    operationId: "broadcastNotification",
    description: `지정된 대상 필터에 따라 여러 사용자에게 알림을 발송합니다.

**대상 필터 옵션**
- \`ALL\`: 모든 활성 사용자
- \`WITH_PUSH_TOKEN\`: 푸시 토큰이 등록된 사용자
- \`ACTIVE_LAST_7_DAYS\`: 최근 7일 내 활동한 사용자
- \`ACTIVE_LAST_30_DAYS\`: 최근 30일 내 활동한 사용자
- \`SUBSCRIBERS\`: 유료 구독 사용자`,
  })
  @ApiCreatedResponse({ type: BroadcastResultDto })
  @ApiBadRequestError(ErrorCode.SYS_0002)
  @ApiBadRequestError(ErrorCode.ADMIN_1403)
  @ApiForbiddenError(ErrorCode.ADMIN_1401)
  @ApiNotFoundError(ErrorCode.ADMIN_1402)
  async broadcastNotification(
    @CurrentUser() _user: CurrentUserPayload,
    @Body({ schema: BroadcastNotificationDto }) dto: BroadcastNotificationDto,
  ): Promise<BroadcastResultDto> {
    return this.#broadcastNotification.execute({
      title: dto.title,
      body: dto.body,
      targetFilter: dto.targetFilter,
      action: dto.action,
      force: dto.force,
    });
  }

  @Post("targeted")
  @Admin()
  @ApiDoc({
    summary: "특정 사용자 알림 발송",
    operationId: "sendTargetedNotification",
    description: `지정된 사용자 ID 목록에 해당하는 사용자들에게 알림을 발송합니다.

존재하지 않는 사용자 ID는 자동으로 필터링됩니다.`,
  })
  @ApiCreatedResponse({ type: BroadcastResultDto })
  @ApiBadRequestError(ErrorCode.SYS_0002)
  @ApiForbiddenError(ErrorCode.ADMIN_1401)
  @ApiNotFoundError(ErrorCode.ADMIN_1402)
  async sendTargetedNotification(
    @CurrentUser() _user: CurrentUserPayload,
    @Body({ schema: TargetedNotificationDto }) dto: TargetedNotificationDto,
  ): Promise<BroadcastResultDto> {
    return this.#sendTargetedNotification.execute({
      title: dto.title,
      body: dto.body,
      userIds: dto.userIds,
      action: dto.action,
      force: dto.force,
    });
  }
}
