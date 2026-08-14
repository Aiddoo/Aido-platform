import { ErrorCode } from "@aido/errors";
import { NOTIFICATION_CATEGORY } from "@aido/validators";
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
	Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";

import { Locale, Timezone } from "@/shared/presentation/decorators";
import {
	ApiBadRequestError,
	ApiCreatedResponse,
	ApiDoc,
	ApiForbiddenError,
	ApiNotFoundError,
	ApiSuccessResponse,
	ApiUnauthorizedError,
	SWAGGER_TAGS,
} from "@/shared/presentation/swagger";

import { CurrentUser, type CurrentUserPayload, Public } from "../../auth/presentation/decorators";
import { GetNotificationsUseCase } from "../application/use-cases/get-notifications/get-notifications.use-case";
import { GetUnreadCountUseCase } from "../application/use-cases/get-unread-count/get-unread-count.use-case";
import { MarkAllAsReadUseCase } from "../application/use-cases/mark-all-as-read/mark-all-as-read.use-case";
import { MarkAsReadUseCase } from "../application/use-cases/mark-as-read/mark-as-read.use-case";
import { MarkNotificationOpenedUseCase } from "../application/use-cases/mark-notification-opened/mark-notification-opened.use-case";
import { OptOutMarketingPushUseCase } from "../application/use-cases/opt-out-marketing-push/opt-out-marketing-push.use-case";
import { RegisterPushTokenUseCase } from "../application/use-cases/register-push-token/register-push-token.use-case";
import { UnregisterPushTokenUseCase } from "../application/use-cases/unregister-push-token/unregister-push-token.use-case";
import {
	GetNotificationsQueryDto,
	MarketingPushOptOutDto,
	MarketingPushOptOutResponseDto,
	MarkReadResponseDto,
	NotificationIdParamDto,
	NotificationListResponseDto,
	NotificationOpenedResponseDto,
	RegisterPushTokenDto,
	RegisterTokenResponseDto,
	UnreadCountResponseDto,
} from "./dtos";
import { NotificationMapper } from "./notification.mapper";

@ApiTags(SWAGGER_TAGS.NOTIFICATIONS)
@ApiBearerAuth()
@Controller("notifications")
export class NotificationController {
	readonly #logger = new Logger(NotificationController.name);

	constructor(
		private readonly getNotificationsUseCase: GetNotificationsUseCase,
		private readonly getUnreadCountUseCase: GetUnreadCountUseCase,
		private readonly markAsReadUseCase: MarkAsReadUseCase,
		private readonly markNotificationOpenedUseCase: MarkNotificationOpenedUseCase,
		private readonly markAllAsReadUseCase: MarkAllAsReadUseCase,
		private readonly registerPushTokenUseCase: RegisterPushTokenUseCase,
		private readonly unregisterPushTokenUseCase: UnregisterPushTokenUseCase,
		private readonly optOutMarketingPushUseCase: OptOutMarketingPushUseCase,
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
		@Body() dto: MarketingPushOptOutDto,
	): Promise<MarketingPushOptOutResponseDto> {
		await this.optOutMarketingPushUseCase.execute(dto.token);
		// 토큰 유효 여부를 노출하지 않아 사용자 열거/토큰 탐색을 방지한다.
		return { optedOut: true };
	}

	@Post("token")
	@ApiDoc({
		summary: "푸시 토큰 등록",
		operationId: "registerPushToken",
		description: `Expo 푸시 토큰을 서버에 등록합니다.

**요청 필드**
- \`token\` (필수): Expo 푸시 토큰
- \`deviceId\` (선택): 기기 고유 ID

동일 deviceId의 기존 토큰이 있으면 갱신됩니다.`,
	})
	@ApiHeader({
		name: "X-Timezone",
		description: 'IANA 타임존 (e.g. "Asia/Seoul")',
		required: false,
		example: "Asia/Seoul",
	})
	@ApiHeader({
		name: "Accept-Language",
		description: '푸시 알림 언어 ("ko" | "en"). 미전송 시 기존 설정 유지, 미지원 언어는 ko',
		required: false,
		example: "ko",
	})
	@ApiCreatedResponse({ type: RegisterTokenResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiBadRequestError(ErrorCode.NOTIFICATION_1001)
	async registerToken(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: RegisterPushTokenDto,
		@Timezone({ preserveIfMissing: true }) tz: string | undefined,
		@Locale() locale: string | undefined,
	): Promise<RegisterTokenResponseDto> {
		this.#logger.debug(`푸시 토큰 등록: userId=${user.userId}`);

		await this.registerPushTokenUseCase.execute({
			userId: user.userId,
			token: dto.token,
			deviceId: dto.deviceId,
			timezone: tz,
			locale,
			payloadVersion: dto.payloadVersion,
			appVersion: dto.appVersion,
		});

		this.#logger.log(`푸시 토큰 등록 완료: userId=${user.userId}`);

		return {
			message: "푸시 토큰이 등록되었습니다.",
			registered: true,
		};
	}

	@Delete("token")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "푸시 토큰 해제",
		operationId: "unregisterPushToken",
		description: `등록된 푸시 토큰을 해제합니다.

**쿼리 파라미터**
- \`deviceId\` (선택): 특정 기기의 토큰만 해제. 미지정 시 모든 토큰 해제`,
	})
	@ApiQuery({
		name: "deviceId",
		required: false,
		description: "특정 기기의 토큰만 해제. 미지정 시 모든 토큰 해제",
	})
	@ApiSuccessResponse({ type: RegisterTokenResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async unregisterToken(
		@CurrentUser() user: CurrentUserPayload,
		@Query("deviceId") deviceId?: string,
	): Promise<RegisterTokenResponseDto> {
		this.#logger.debug(`푸시 토큰 해제: userId=${user.userId}, deviceId=${deviceId ?? "all"}`);

		await this.unregisterPushTokenUseCase.execute(user.userId, deviceId);

		this.#logger.log(`푸시 토큰 해제 완료: userId=${user.userId}, deviceId=${deviceId ?? "all"}`);

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
		@Query() query: GetNotificationsQueryDto,
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

		return {
			notifications: NotificationMapper.toDtoList(result.items),
			unreadCount,
			hasMore: result.pagination.hasNext,
			nextCursor: result.pagination.nextCursor ?? null,
		};
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
		@Param() params: NotificationIdParamDto,
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
		@Param() params: NotificationIdParamDto,
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
