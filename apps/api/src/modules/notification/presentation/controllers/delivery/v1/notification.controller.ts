import { ErrorCode } from "@aido/api/errors";
import {
  NOTIFICATION_CATEGORY,
  PUSH_DEVICE_PLATFORM,
  PUSH_PERMISSION_STATUS,
} from "@aido/api/vocabulary";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { match } from "ts-pattern";

import {
  CurrentUser,
  type CurrentUserPayload,
  Public,
} from "#api/modules/identity/identity-auth-http.public";
import {
  CurrentRequestClient,
  type RequestClient,
  requestTimezoneIfSent,
} from "#api/platform/http/request-client/index";
import {
  ApiCreatedResponse,
  ApiBadRequestError,
  ApiDoc,
  ApiErrorCodesResponse,
  ApiForbiddenError,
  ApiNotFoundError,
  ApiSuccessResponse,
  ApiUnauthorizedError,
  SWAGGER_TAGS,
} from "#api/platform/http/swagger/index";
import { ThrottleByUser } from "#api/platform/throttle/index";

import { GetNotifications } from "../../../../application/use-cases/delivery/get-notifications.use-case.js";
import { GetUnreadCount } from "../../../../application/use-cases/delivery/get-unread-count.use-case.js";
import { MarkAllAsRead } from "../../../../application/use-cases/delivery/mark-all-as-read.use-case.js";
import { MarkAsRead } from "../../../../application/use-cases/delivery/mark-as-read.use-case.js";
import { MarkNotificationOpened } from "../../../../application/use-cases/delivery/mark-notification-opened.use-case.js";
import { OptOutMarketingPush } from "../../../../application/use-cases/delivery/opt-out-marketing-push.use-case.js";
import { ReportPushDevice } from "../../../../application/use-cases/delivery/report-push-device.use-case.js";
import { UnregisterPushDevice } from "../../../../application/use-cases/delivery/unregister-push-device.use-case.js";
import { NotificationMapper } from "../../../mappers/delivery/v1/notification.mapper.js";
import { PushDeviceMapper } from "../../../mappers/delivery/v1/push-device.mapper.js";
import {
  GetNotificationsQueryDto,
  MarketingPushOptOutDto,
  MarketingPushOptOutResponseDto,
  MarkReadResponseDto,
  NotificationIdParamDto,
  NotificationListResponseDto,
  NotificationOpenedResponseDto,
  PushDeviceParamDto,
  PushDeviceResponseDto,
  RegisterPushTokenDto,
  RegisterTokenResponseDto,
  ReportPushDeviceDto,
  UnreadCountResponseDto,
  UnregisterPushTokenQueryDto,
} from "../../../schemas/delivery/v1/index.js";

/** 1.14.1 이하 앱이 deviceId 없이 등록할 때 쓰던 값. */
const LEGACY_DEFAULT_DEVICE_ID = "default";

function pushDeviceContext(client: RequestClient) {
  return {
    platformHint: match(client.platform)
      .with(PUSH_DEVICE_PLATFORM.IOS, PUSH_DEVICE_PLATFORM.ANDROID, (platform) => platform)
      .otherwise(() => undefined),
    deviceModel: client.deviceName ?? undefined,
    osVersion: client.osVersion ?? undefined,
    timezone: requestTimezoneIfSent(client),
    locale: client.locale ?? undefined,
  };
}

@ApiTags(SWAGGER_TAGS.NOTIFICATIONS)
@ApiBearerAuth()
@Controller("notifications")
export class NotificationController {
  readonly #logger = new Logger(NotificationController.name);

  constructor(
    private readonly getNotificationsUseCase: GetNotifications,
    private readonly getUnreadCountUseCase: GetUnreadCount,
    private readonly markAsReadUseCase: MarkAsRead,
    private readonly markNotificationOpenedUseCase: MarkNotificationOpened,
    private readonly markAllAsReadUseCase: MarkAllAsRead,
    private readonly reportPushDeviceUseCase: ReportPushDevice,
    private readonly unregisterPushDeviceUseCase: UnregisterPushDevice,
    private readonly optOutMarketingPushUseCase: OptOutMarketingPush,
  ) {}

  @Post("marketing-push/opt-out")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiDoc({
    summary: "광고성 앱 푸시 수신 철회",
    operationId: "optOutMarketingPush",
    description: "푸시 액션에 포함된 서명 토큰으로 로그인 없이 수신을 철회합니다.",
  })
  @ApiSuccessResponse({ type: MarketingPushOptOutResponseDto })
  async optOutMarketingPush(
    @Body({ schema: MarketingPushOptOutDto }) dto: MarketingPushOptOutDto,
  ): Promise<MarketingPushOptOutResponseDto> {
    await this.optOutMarketingPushUseCase.execute(dto.token);
    // 토큰 유효 여부를 노출하지 않아 사용자 열거/토큰 탐색을 방지한다.
    return { optedOut: true };
  }

  @Put("push-devices/:deviceId")
  @HttpCode(HttpStatus.OK)
  @ThrottleByUser()
  @ApiParam({
    name: "deviceId",
    description: "앱이 만든 기기 식별자. ios_ 또는 android_로 시작",
    schema: { type: "string", maxLength: 100 },
    example: "ios_5F2C1E7A-0B9D-4C3E-8A11-2D4F6B8C9E01",
  })
  @ApiDoc({
    summary: "푸시 기기 보고",
    operationId: "reportPushDevice",
    description: `기기 하나의 알림 권한과 Expo 푸시 토큰을 보고합니다. 1.14.2 이상 앱이 로그인 직후·앱 복귀·토큰 변경·언어 변경 때 보냅니다.

- 권한이 GRANTED·PROVISIONAL이고 \`token\`이 있으면 이 기기로 푸시를 보냅니다.
- 권한이 없거나 \`token\`이 null이면 이 기기의 토큰을 지우고 권한 상태만 저장합니다.
- 다른 계정이 쓰던 같은 기기·토큰은 이 사용자로 옮깁니다.
- 플랫폼은 deviceId 접두어로, 시간대·언어는 헤더로 정합니다. 같은 값을 다시 보내도 결과는 같습니다.`,
  })
  @ApiHeader({
    name: "X-Timezone",
    description: '푸시 발송 시간대로 쓸 IANA 시간대 (e.g. "Asia/Seoul"). 없으면 저장된 값을 유지',
    required: false,
    example: "Asia/Seoul",
  })
  @ApiHeader({
    name: "Accept-Language",
    description: '푸시 알림 언어 ("ko" | "en"). 없으면 저장된 값을 유지, 지원하지 않는 언어는 ko',
    required: false,
    example: "ko",
  })
  @ApiHeader({
    name: "X-App-Version",
    description: "토큰과 함께 저장해 앱 버전별 푸시 형식을 고를 때 쓰는 앱 버전",
    required: false,
    example: "1.14.2",
  })
  @ApiSuccessResponse({ type: PushDeviceResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiErrorCodesResponse(HttpStatus.BAD_REQUEST, [
    ErrorCode.NOTIFICATION_1001,
    ErrorCode.NOTIFICATION_1006,
  ])
  async reportPushDevice(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: PushDeviceParamDto }) params: PushDeviceParamDto,
    @Body({ schema: ReportPushDeviceDto }) dto: ReportPushDeviceDto,
    @CurrentRequestClient() client: RequestClient,
  ): Promise<PushDeviceResponseDto> {
    const report = await this.reportPushDeviceUseCase.execute({
      ...pushDeviceContext(client),
      userId: user.userId,
      deviceId: params.deviceId,
      permission: dto.permission,
      token: dto.token,
      payloadVersion: dto.payloadVersion,
      appVersion: client.appVersion ?? undefined,
    });
    return PushDeviceMapper.toDto(report);
  }

  @Post("token")
  @ApiDoc({
    summary: "푸시 토큰 등록 (1.14.1 이하 앱)",
    operationId: "registerPushToken",
    deprecated: true,
    description: `1.14.1 이하 앱이 권한을 허용한 뒤 토큰을 등록합니다. 새 앱은 \`PUT /v1/notifications/push-devices/{deviceId}\`를 씁니다.

권한은 허용(GRANTED)으로 저장하고, 플랫폼은 deviceId 접두어나 \`X-Device-Type\` 헤더로 정합니다. 둘 다 없으면 400 NOTIFICATION_1006입니다(출시된 앱은 항상 접두어를 보냅니다). 같은 deviceId의 토큰은 갱신됩니다. 최소 지원 버전이 1.14.2가 되면 제거합니다.`,
  })
  @ApiHeader({
    name: "X-Timezone",
    description: '푸시 발송 시간대로 쓸 IANA 시간대 (e.g. "Asia/Seoul"). 없으면 저장된 값을 유지',
    required: false,
    example: "Asia/Seoul",
  })
  @ApiHeader({
    name: "Accept-Language",
    description: '푸시 알림 언어 ("ko" | "en"). 없으면 저장된 값을 유지, 지원하지 않는 언어는 ko',
    required: false,
    example: "ko",
  })
  @ApiCreatedResponse({ type: RegisterTokenResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiBadRequestError(ErrorCode.NOTIFICATION_1001)
  async registerToken(
    @CurrentUser() user: CurrentUserPayload,
    @Body({ schema: RegisterPushTokenDto }) dto: RegisterPushTokenDto,
    @CurrentRequestClient() client: RequestClient,
  ): Promise<RegisterTokenResponseDto> {
    await this.reportPushDeviceUseCase.execute({
      ...pushDeviceContext(client),
      userId: user.userId,
      deviceId: dto.deviceId ?? LEGACY_DEFAULT_DEVICE_ID,
      permission: { status: PUSH_PERMISSION_STATUS.GRANTED, canAskAgain: false },
      token: dto.token,
      payloadVersion: dto.payloadVersion,
      appVersion: dto.appVersion ?? client.appVersion ?? undefined,
    });

    return {
      message: "푸시 토큰이 등록되었습니다.",
      registered: true,
    };
  }

  @Delete("token")
  @HttpCode(HttpStatus.OK)
  @ApiDoc({
    summary: "푸시 기기 해제",
    operationId: "unregisterPushToken",
    description: `로그아웃한 기기를 푸시 대상에서 뺍니다. 기기의 토큰과 권한 기록을 함께 지웁니다.

**쿼리 파라미터**
- \`deviceId\` (선택): 이 기기만 해제. 없으면 사용자의 모든 기기를 해제
- 등록되지 않은 기기여도 성공으로 응답합니다.`,
  })
  @ApiSuccessResponse({ type: RegisterTokenResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async unregisterToken(
    @CurrentUser() user: CurrentUserPayload,
    @Query({ schema: UnregisterPushTokenQueryDto }) query: UnregisterPushTokenQueryDto,
  ): Promise<RegisterTokenResponseDto> {
    await this.unregisterPushDeviceUseCase.execute(user.userId, query.deviceId);

    return {
      message: "푸시 토큰이 해제되었습니다.",
      registered: false,
    };
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
  ): Promise<NotificationListResponseDto> {
    this.#logger.debug(`알림 목록 조회: userId=${user.userId}, category=${query.category}`);

    const [result, unreadCount] = await Promise.all([
      this.getNotificationsUseCase.execute({
        userId: user.userId,
        cursor: query.cursor,
        size: query.limit,
        unreadOnly: query.unreadOnly,
        category: query.category,
      }),
      this.getUnreadCountUseCase.execute(user.userId),
    ]);

    return NotificationListResponseDto.parse({
      notifications: NotificationMapper.toDtoList(result.items),
      unreadCount,
      hasMore: result.pagination.hasNext,
      nextCursor: result.pagination.nextCursor ?? null,
    });
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
    const unreadCount = await this.getUnreadCountUseCase.execute(user.userId);

    return { unreadCount };
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
    this.#logger.debug(`알림 읽음 처리: userId=${user.userId}, id=${params.id}`);

    await this.markAsReadUseCase.execute(user.userId, params.id);

    return {
      message: "알림을 읽음 처리했습니다.",
      readCount: 1,
    };
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
    const opened = await this.markNotificationOpenedUseCase.execute(user.userId, params.id);
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
    this.#logger.debug(`모든 알림 읽음 처리: userId=${user.userId}`);

    const result = await this.markAllAsReadUseCase.execute(user.userId);

    return {
      message: "모든 알림을 읽음 처리했습니다.",
      readCount: result.count,
    };
  }
}
