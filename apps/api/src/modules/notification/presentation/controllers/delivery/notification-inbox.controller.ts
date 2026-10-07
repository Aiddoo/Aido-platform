import { ErrorCode } from "@aido/api/errors";
import {
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Patch,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import {
  ApiDoc,
  ApiSuccessResponse,
  ApiUnauthorizedError,
  SWAGGER_TAGS,
} from "#api/platform/http/swagger/index";

import { GetNotifications } from "../../../application/use-cases/delivery/get-notifications.use-case.js";
import { GetUnreadCount } from "../../../application/use-cases/delivery/get-unread-count.use-case.js";
import { MarkAllAsRead } from "../../../application/use-cases/delivery/mark-all-as-read.use-case.js";
import { NotificationMapper } from "../../mappers/delivery/notification.mapper.js";
import {
  GetNotificationsQueryDto,
  MarkReadResponseDto,
  UnreadCountResponseDto,
} from "../../schemas/delivery/index.js";
import { NotificationInboxResponseDto } from "../../schemas/delivery/notification-inbox.response.dto.js";

@ApiTags(SWAGGER_TAGS.NOTIFICATIONS)
@ApiBearerAuth()
@ApiHeader({
  name: "X-App-Version",
  required: false,
  description: "설치된 앱 버전. 1.11.0 이상에서 콕 답장·감사 알림을 표시합니다.",
})
@Controller("notifications/inbox")
export class NotificationInboxController {
  constructor(
    private readonly getNotificationsUseCase: GetNotifications,
    private readonly getUnreadCountUseCase: GetUnreadCount,
    private readonly markAllAsReadUseCase: MarkAllAsRead,
  ) {}

  @Get()
  @Header("Vary", "Origin, X-App-Version")
  @ApiDoc({ summary: "알림함 조회", operationId: "getNotificationInbox" })
  @ApiSuccessResponse({ type: NotificationInboxResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async getInbox(
    @CurrentUser() user: CurrentUserPayload,
    @Query({ schema: GetNotificationsQueryDto }) query: GetNotificationsQueryDto,
    @Headers("x-app-version") appVersion?: string,
  ): Promise<NotificationInboxResponseDto> {
    const [page, unreadCount] = await Promise.all([
      this.getNotificationsUseCase.execute({
        userId: user.userId,
        cursor: query.cursor,
        size: query.limit,
        unreadOnly: query.unreadOnly,
        category: query.category,
        appVersion,
      }),
      this.getUnreadCountUseCase.execute(user.userId, appVersion),
    ]);
    return {
      notifications: NotificationMapper.toDtoList(page.items),
      unreadCount,
      hasMore: page.pagination.hasNext,
      nextCursor: page.pagination.nextCursor,
    };
  }

  @Get("unread-count")
  @Header("Vary", "Origin, X-App-Version")
  @ApiDoc({ summary: "알림함의 미읽음 개수 조회", operationId: "getNotificationInboxUnreadCount" })
  @ApiSuccessResponse({ type: UnreadCountResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async getUnreadCount(
    @CurrentUser() user: CurrentUserPayload,
    @Headers("x-app-version") appVersion?: string,
  ): Promise<UnreadCountResponseDto> {
    return { unreadCount: await this.getUnreadCountUseCase.execute(user.userId, appVersion) };
  }

  @Patch("read-all")
  @HttpCode(HttpStatus.OK)
  @ApiDoc({ summary: "알림함 전체 읽음 처리", operationId: "markNotificationInboxAsRead" })
  @ApiSuccessResponse({ type: MarkReadResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async markAllAsRead(
    @CurrentUser() user: CurrentUserPayload,
    @Headers("x-app-version") appVersion?: string,
  ): Promise<MarkReadResponseDto> {
    const result = await this.markAllAsReadUseCase.execute(user.userId, appVersion);
    return { message: "모든 알림을 읽음 처리했습니다.", readCount: result.count };
  }
}
