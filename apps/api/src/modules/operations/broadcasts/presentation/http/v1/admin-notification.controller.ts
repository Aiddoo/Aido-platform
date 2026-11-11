import { randomUUID } from "node:crypto";

import { ErrorCode } from "@aido/api/errors";
import { Body, Controller, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import {
  Admin,
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiBadRequestError,
  ApiForbiddenError,
  ApiNotFoundError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiCreatedResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";

import { BroadcastNotificationUseCase } from "../../../application/use-cases/broadcast-notification.use-case.js";
import { SendTargetedNotificationUseCase } from "../../../application/use-cases/send-targeted-notification.use-case.js";
import {
  toBroadcastResultResponse,
  toTargetedResultResponse,
} from "./admin-notification-response.mapper.js";
import {
  BroadcastNotificationDto,
  BroadcastResultDto,
  TargetedNotificationDto,
} from "./admin-notification.dto.js";

@ApiTags(SWAGGER_TAGS.ADMIN_NOTIFICATIONS)
@ApiBearerAuth()
@Controller("admin/notifications")
export class AdminNotificationController {
  readonly #broadcastNotification: Pick<BroadcastNotificationUseCase, "execute">;
  readonly #sendTargetedNotification: Pick<SendTargetedNotificationUseCase, "execute">;

  constructor(
    broadcastNotification: BroadcastNotificationUseCase,
    sendTargetedNotification: SendTargetedNotificationUseCase,
  ) {
    this.#broadcastNotification = broadcastNotification;
    this.#sendTargetedNotification = sendTargetedNotification;
  }

  @Post("broadcast")
  @Admin()
  @ApiDoc({
    summary: "전체/조건부 알림 발송",
    operationId: "broadcastNotification",
    deprecated: true,
    description: `관리자 도구가 v2 캠페인 API(\`POST /v2/admin/notifications/broadcasts\`)로 옮길 때까지 유지합니다.

v2와 같은 캠페인으로 접수하고 바로 응답합니다. 응답 수는 접수 시점에 발송 대기열에 올릴 대상 수이며 전달 결과가 아닙니다. 요청 ID가 없어 재요청은 새 캠페인이 됩니다.

**대상 필터 옵션**
- \`ALL\`: 모든 활성 사용자
- \`WITH_PUSH_TOKEN\`: 푸시 토큰이 등록된 사용자
- \`ACTIVE_LAST_7_DAYS\`: 최근 7일 내 활동한 사용자
- \`ACTIVE_LAST_30_DAYS\`: 최근 30일 내 활동한 사용자
- \`SUBSCRIBERS\`: 유료 구독 사용자`,
  })
  @ApiCreatedResponse({ type: BroadcastResultDto })
  @ApiBadRequestError(ErrorCode.ADMIN_1403)
  @ApiForbiddenError(ErrorCode.ADMIN_1401)
  @ApiNotFoundError(ErrorCode.ADMIN_1402)
  async broadcastNotification(
    @CurrentUser() _user: CurrentUserPayload,
    @Body({ schema: BroadcastNotificationDto }) dto: BroadcastNotificationDto,
  ): Promise<BroadcastResultDto> {
    const result = await this.#broadcastNotification.execute({
      requestId: randomUUID(),
      title: dto.title,
      body: dto.body,
      targetFilter: dto.targetFilter,
      ...(dto.action != null && { action: dto.action }),
      force: dto.force,
    });
    return toBroadcastResultResponse(result);
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
  @ApiForbiddenError(ErrorCode.ADMIN_1401)
  @ApiNotFoundError(ErrorCode.ADMIN_1402)
  async sendTargetedNotification(
    @CurrentUser() _user: CurrentUserPayload,
    @Body({ schema: TargetedNotificationDto }) dto: TargetedNotificationDto,
  ): Promise<BroadcastResultDto> {
    const result = await this.#sendTargetedNotification.execute({
      title: dto.title,
      body: dto.body,
      userIds: dto.userIds,
      ...(dto.action != null && { action: dto.action }),
      force: dto.force,
    });
    return toTargetedResultResponse(result);
  }
}
