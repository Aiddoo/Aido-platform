import { ErrorCode } from "@aido/api/errors";
import { NOTIFICATION_CATEGORY } from "@aido/api/vocabulary";
import { Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { type RequestClient } from "#api/platform/http/request-client/request-client";
import { CurrentRequestClient } from "#api/platform/http/request-client/request-client.decorator";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiForbiddenError,
  ApiNotFoundError,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";

import { GetUnreadNotificationCountUseCase } from "../../../application/use-cases/get-unread-notification-count.use-case.js";
import { ListNotificationsUseCase } from "../../../application/use-cases/list-notifications.use-case.js";
import { MarkAllNotificationsReadUseCase } from "../../../application/use-cases/mark-all-notifications-read.use-case.js";
import { MarkNotificationOpenedUseCase } from "../../../application/use-cases/mark-notification-opened.use-case.js";
import { MarkNotificationReadUseCase } from "../../../application/use-cases/mark-notification-read.use-case.js";
import {
  NOTIFICATION_RESPONSE_MESSAGES,
  toNotificationInboxResponse,
} from "./notification-response.mapper.js";
import {
  GetNotificationsQueryDto,
  MarkReadResponseDto,
  NotificationIdParamDto,
  NotificationListResponseDto,
  NotificationOpenedResponseDto,
  UnreadCountResponseDto,
} from "./notification.dto.js";

@ApiTags(SWAGGER_TAGS.NOTIFICATIONS)
@ApiBearerAuth()
@Controller({ path: "notifications", version: API_VERSION.V1 })
export class NotificationController {
  readonly #listNotifications: ListNotificationsUseCase;
  readonly #getUnreadNotificationCount: GetUnreadNotificationCountUseCase;
  readonly #markNotificationRead: MarkNotificationReadUseCase;
  readonly #markNotificationOpened: MarkNotificationOpenedUseCase;
  readonly #markAllNotificationsRead: MarkAllNotificationsReadUseCase;

  constructor(
    listNotifications: ListNotificationsUseCase,
    getUnreadNotificationCount: GetUnreadNotificationCountUseCase,
    markNotificationRead: MarkNotificationReadUseCase,
    markNotificationOpened: MarkNotificationOpenedUseCase,
    markAllNotificationsRead: MarkAllNotificationsReadUseCase,
  ) {
    this.#listNotifications = listNotifications;
    this.#getUnreadNotificationCount = getUnreadNotificationCount;
    this.#markNotificationRead = markNotificationRead;
    this.#markNotificationOpened = markNotificationOpened;
    this.#markAllNotificationsRead = markAllNotificationsRead;
  }

  @Get()
  @ApiDoc({
    summary: "알림 목록 조회",
    operationId: "getNotifications",
    description: `알림 목록을 커서 기반 페이지네이션으로 조회합니다.

**쿼리 파라미터**
- \`limit\` (기본값: 20): 조회할 알림 수 (1-50)
- \`cursor\`: 페이지네이션 커서 (이전 응답의 nextCursor)
- \`unreadOnly\`: 읽지 않은 알림만 조회
- \`category\`: 알림 카테고리 필터

**카테고리 분류**
| 값 | 설명 | 포함 알림 타입 |
|-----|------|---------------|
| \`ALL\` | 전체 (기본값) | 모든 알림 |
| \`NOTICE\` | 공지 | SYSTEM_NOTICE, ADMIN_BROADCAST, ADMIN_TARGETED, WEEKLY_ACHIEVEMENT, WEEKLY_REPORT |
| \`TODO\` | 할일 | TODO_REMINDER, TODO_SHARED, DAILY_COMPLETE, MORNING_REMINDER, EVENING_REMINDER |
| \`SOCIAL\` | 소셜 | FOLLOW_NEW, FOLLOW_ACCEPTED, NUDGE_RECEIVED, CHEER_RECEIVED, FRIEND_COMPLETED |

**조합 사용 예시**
- \`?category=SOCIAL&unreadOnly=true\` — 읽지 않은 소셜 알림만
- \`?category=TODO&limit=10\` — 할일 알림 10개`,
  })
  @ApiQuery({
    name: "category",
    required: false,
    description: "알림 카테고리 필터 (ALL: 전체, NOTICE: 공지, TODO: 할일, SOCIAL: 소셜)",
    enum: Object.values(NOTIFICATION_CATEGORY),
    example: "ALL",
  })
  @ApiSuccessResponse({ type: NotificationListResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async getNotifications(
    @CurrentUser() user: CurrentUserPayload,
    @Query({ schema: GetNotificationsQueryDto }) query: GetNotificationsQueryDto,
    @CurrentRequestClient() client: RequestClient,
  ): Promise<NotificationListResponseDto> {
    const [page, unreadCount] = await Promise.all([
      this.#listNotifications.execute({
        userId: user.userId,
        cursor: query.cursor,
        size: query.limit,
        unreadOnly: query.unreadOnly,
        category: query.category,
      }),
      this.#getUnreadNotificationCount.execute({ userId: user.userId }),
    ]);
    // 옛 앱 계약이라 알림함 전용 필드(navigation)와 새 타입은 parse가 걸러 낸다
    return NotificationListResponseDto.parse(
      toNotificationInboxResponse(page, unreadCount, client.locale),
    );
  }

  @Get("unread-count")
  @ApiDoc({
    summary: "읽지 않은 알림 수 조회",
    operationId: "getUnreadCount",
    description: `읽지 않은 알림 개수를 반환합니다. 앱 배지 카운트 갱신에 사용됩니다.`,
  })
  @ApiSuccessResponse({ type: UnreadCountResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async getUnreadCount(@CurrentUser() user: CurrentUserPayload): Promise<UnreadCountResponseDto> {
    return { unreadCount: await this.#getUnreadNotificationCount.execute({ userId: user.userId }) };
  }

  @Patch(":id/read")
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: "id",
    description: "읽음 처리할 알림 ID (양의 정수)",
    schema: { type: "number" },
    example: 1,
  })
  @ApiDoc({
    summary: "단일 알림 읽음 처리",
    operationId: "markNotificationAsRead",
    description: `특정 알림을 읽음 상태로 변경합니다. 이미 읽은 알림은 무시됩니다.`,
  })
  @ApiSuccessResponse({ type: MarkReadResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.NOTIFICATION_1004)
  @ApiForbiddenError(ErrorCode.NOTIFICATION_1005)
  async markAsRead(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: NotificationIdParamDto }) params: NotificationIdParamDto,
  ): Promise<MarkReadResponseDto> {
    await this.#markNotificationRead.execute({ userId: user.userId, notificationId: params.id });
    return { message: NOTIFICATION_RESPONSE_MESSAGES.READ, readCount: 1 };
  }

  @Post(":id/opened")
  @HttpCode(HttpStatus.OK)
  @ApiDoc({
    summary: "푸시 알림 열기 기록",
    operationId: "markNotificationOpened",
    description: "푸시 탭을 멱등 기록하고 해당 알림을 읽음 처리합니다.",
  })
  @ApiSuccessResponse({ type: NotificationOpenedResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async markOpened(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: NotificationIdParamDto }) params: NotificationIdParamDto,
  ): Promise<NotificationOpenedResponseDto> {
    const opened = await this.#markNotificationOpened.execute({
      userId: user.userId,
      notificationId: params.id,
    });
    return { opened };
  }

  @Patch("read-all")
  @HttpCode(HttpStatus.OK)
  @ApiDoc({
    summary: "모든 알림 읽음 처리",
    operationId: "markAllNotificationsAsRead",
    description: `모든 읽지 않은 알림을 읽음 상태로 변경합니다.`,
  })
  @ApiSuccessResponse({ type: MarkReadResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async markAllAsRead(@CurrentUser() user: CurrentUserPayload): Promise<MarkReadResponseDto> {
    const result = await this.#markAllNotificationsRead.execute({ userId: user.userId });
    return { message: NOTIFICATION_RESPONSE_MESSAGES.READ_ALL, readCount: result.count };
  }
}
