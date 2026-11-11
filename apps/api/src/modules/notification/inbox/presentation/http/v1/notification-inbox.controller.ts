import { ErrorCode } from "@aido/api/errors";
import { Controller, Get, Header, HttpCode, HttpStatus, Patch, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { type RequestClient } from "#api/platform/http/request-client/request-client";
import { CurrentRequestClient } from "#api/platform/http/request-client/request-client.decorator";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import { ApiUnauthorizedError } from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";

import { GetUnreadNotificationCountUseCase } from "../../../application/use-cases/get-unread-notification-count.use-case.js";
import { ListNotificationsUseCase } from "../../../application/use-cases/list-notifications.use-case.js";
import { MarkAllNotificationsReadUseCase } from "../../../application/use-cases/mark-all-notifications-read.use-case.js";
import {
  NOTIFICATION_RESPONSE_MESSAGES,
  toNotificationInboxResponse,
} from "./notification-response.mapper.js";
import {
  GetNotificationsQueryDto,
  MarkReadResponseDto,
  NotificationInboxResponseDto,
  UnreadCountResponseDto,
} from "./notification.dto.js";

@ApiTags(SWAGGER_TAGS.NOTIFICATIONS)
@ApiBearerAuth()
@ApiHeader({
  name: "X-App-Version",
  required: false,
  description: "설치된 앱 버전. 1.11.0 이상에서 콕 답장·감사 알림을 표시합니다.",
})
@Controller("notifications/inbox")
export class NotificationInboxController {
  readonly #listNotifications: ListNotificationsUseCase;
  readonly #getUnreadNotificationCount: GetUnreadNotificationCountUseCase;
  readonly #markAllNotificationsRead: MarkAllNotificationsReadUseCase;

  constructor(
    listNotifications: ListNotificationsUseCase,
    getUnreadNotificationCount: GetUnreadNotificationCountUseCase,
    markAllNotificationsRead: MarkAllNotificationsReadUseCase,
  ) {
    this.#listNotifications = listNotifications;
    this.#getUnreadNotificationCount = getUnreadNotificationCount;
    this.#markAllNotificationsRead = markAllNotificationsRead;
  }

  @Get()
  @Header("Vary", "Origin, X-App-Version")
  @ApiDoc({ summary: "알림함 조회", operationId: "getNotificationInbox" })
  @ApiSuccessResponse({ type: NotificationInboxResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async getInbox(
    @CurrentUser() user: CurrentUserPayload,
    @Query({ schema: GetNotificationsQueryDto }) query: GetNotificationsQueryDto,
    @CurrentRequestClient() client: RequestClient,
  ): Promise<NotificationInboxResponseDto> {
    const appVersion = client.appVersion ?? undefined;
    const [page, unreadCount] = await Promise.all([
      this.#listNotifications.execute({
        userId: user.userId,
        cursor: query.cursor,
        size: query.limit,
        unreadOnly: query.unreadOnly,
        category: query.category,
        appVersion,
      }),
      this.#getUnreadNotificationCount.execute({ userId: user.userId, appVersion }),
    ]);
    return toNotificationInboxResponse(page, unreadCount, client.locale);
  }

  @Get("unread-count")
  @Header("Vary", "Origin, X-App-Version")
  @ApiDoc({ summary: "알림함의 미읽음 개수 조회", operationId: "getNotificationInboxUnreadCount" })
  @ApiSuccessResponse({ type: UnreadCountResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async getUnreadCount(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentRequestClient() client: RequestClient,
  ): Promise<UnreadCountResponseDto> {
    const unreadCount = await this.#getUnreadNotificationCount.execute({
      userId: user.userId,
      appVersion: client.appVersion ?? undefined,
    });
    return { unreadCount };
  }

  @Patch("read-all")
  @HttpCode(HttpStatus.OK)
  @ApiDoc({ summary: "알림함 전체 읽음 처리", operationId: "markNotificationInboxAsRead" })
  @ApiSuccessResponse({ type: MarkReadResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async markAllAsRead(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentRequestClient() client: RequestClient,
  ): Promise<MarkReadResponseDto> {
    const result = await this.#markAllNotificationsRead.execute({
      userId: user.userId,
      appVersion: client.appVersion ?? undefined,
    });
    return { message: NOTIFICATION_RESPONSE_MESSAGES.READ_ALL, readCount: result.count };
  }
}
