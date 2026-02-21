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
	ParseIntPipe,
	Patch,
	Post,
	Query,
	UseGuards,
} from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiHeader,
	ApiParam,
	ApiQuery,
	ApiTags,
} from "@nestjs/swagger";
import { Timezone } from "@/common/decorators";
import {
	ApiBadRequestError,
	ApiCreatedResponse,
	ApiDoc,
	ApiNotFoundError,
	ApiSuccessResponse,
	ApiUnauthorizedError,
	SWAGGER_TAGS,
} from "@/common/swagger";

import { CurrentUser, type CurrentUserPayload } from "../auth/decorators";
import { JwtAuthGuard } from "../auth/guards";

import {
	GetNotificationsQueryDto,
	MarkReadResponseDto,
	NotificationListResponseDto,
	RegisterPushTokenDto,
	RegisterTokenResponseDto,
	UnreadCountResponseDto,
} from "./dtos";
import { NotificationService } from "./notification.service";
import { PushDeliveryService } from "./push-delivery.service";

/**
 * Notification API 컨트롤러
 *
 * ## 🔔 알림 관리 API
 *
 * 푸시 알림 토큰 등록, 알림 목록 조회, 읽음 처리를 위한 API입니다.
 *
 * ### 주요 엔드포인트
 * - POST /notifications/token - 푸시 토큰 등록/갱신
 * - GET /notifications - 알림 목록 조회 (커서 페이지네이션)
 * - PATCH /notifications/:id/read - 단일 알림 읽음 처리
 * - PATCH /notifications/read-all - 모든 알림 읽음 처리
 *
 * ### 할일 마감 리마인더 (TODO_REMINDER)
 * - **60분 전**: "{제목}, 1시간 남음"
 * - **10분 전**: "{제목}, 10분 남음"
 * - **즉시**: 60분/10분 전이 모두 지난 경우 즉시 발송
 * - 동일 투두+단계 조합은 24시간 내 중복 발송하지 않습니다.
 *
 * ### 아침/저녁 리마인더
 * - **아침 (MORNING_REMINDER)**: morningReminderHour(기본 8시)에 오늘 할일 요약 발송
 * - **저녁 (EVENING_REMINDER)**: eveningReminderHour(기본 18시)에 완료 현황 발송
 *
 * ### 푸시 발송 필터링
 * 1. `pushEnabled=false` → 푸시 스킵 (앱 내 알림은 정상 기록)
 * 2. 야간(21:00-08:00, 로컬 시간) + `nightPushEnabled=false` → 스킵
 *    - 예외: DAILY_COMPLETE, NUDGE_RECEIVED는 야간에도 항상 발송
 * 3. 마케팅 알림 → `marketingAgreedAt` 없으면 스킵
 * 4. Rate limit → 시간당 최대 15건 초과 시 푸시만 스킵
 *
 * 💡 **클라이언트 구현 가이드**: [NOTIFICATION_GUIDE.md](../../docs/NOTIFICATION_GUIDE.md) 참조
 */
@ApiTags(SWAGGER_TAGS.NOTIFICATIONS)
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationController {
	private readonly logger = new Logger(NotificationController.name);

	constructor(
		private readonly notificationService: NotificationService,
		private readonly pushDeliveryService: PushDeliveryService,
	) {}

	// ============================================
	// 푸시 토큰 관리
	// ============================================

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
	@ApiCreatedResponse({ type: RegisterTokenResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiBadRequestError(ErrorCode.NOTIFICATION_1001)
	async registerToken(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: RegisterPushTokenDto,
		@Timezone() tz: string,
	): Promise<RegisterTokenResponseDto> {
		this.logger.debug(`푸시 토큰 등록: userId=${user.userId}`);

		await this.pushDeliveryService.registerPushToken({
			userId: user.userId,
			token: dto.token,
			deviceId: dto.deviceId,
			timezone: tz,
		});

		this.logger.log(`푸시 토큰 등록 완료: userId=${user.userId}`);

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
	@ApiSuccessResponse({ type: RegisterTokenResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async unregisterToken(
		@CurrentUser() user: CurrentUserPayload,
		@Query("deviceId") deviceId?: string,
	): Promise<RegisterTokenResponseDto> {
		this.logger.debug(
			`푸시 토큰 해제: userId=${user.userId}, deviceId=${deviceId ?? "all"}`,
		);

		if (deviceId) {
			await this.pushDeliveryService.unregisterPushToken(user.userId, deviceId);
		} else {
			await this.pushDeliveryService.unregisterAllPushTokens(user.userId);
		}

		this.logger.log(
			`푸시 토큰 해제 완료: userId=${user.userId}, deviceId=${deviceId ?? "all"}`,
		);

		return {
			message: "푸시 토큰이 해제되었습니다.",
			registered: false,
		};
	}

	// ============================================
	// 알림 조회
	// ============================================

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
| \`NOTICE\` | 공지 | SYSTEM_NOTICE, ADMIN_BROADCAST, ADMIN_TARGETED, WEEKLY_ACHIEVEMENT |
| \`TODO\` | 할일 | TODO_REMINDER, TODO_SHARED, DAILY_COMPLETE, MORNING_REMINDER, EVENING_REMINDER |
| \`SOCIAL\` | 소셜 | FOLLOW_NEW, FOLLOW_ACCEPTED, NUDGE_RECEIVED, CHEER_RECEIVED, FRIEND_COMPLETED |

**조합 사용 예시**
- \`?category=SOCIAL&unreadOnly=true\` — 읽지 않은 소셜 알림만
- \`?category=TODO&limit=10\` — 할일 알림 10개`,
	})
	@ApiQuery({
		name: "category",
		required: false,
		description:
			"알림 카테고리 필터 (ALL: 전체, NOTICE: 공지, TODO: 할일, SOCIAL: 소셜)",
		enum: Object.values(NOTIFICATION_CATEGORY),
		example: "ALL",
	})
	@ApiSuccessResponse({ type: NotificationListResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getNotifications(
		@CurrentUser() user: CurrentUserPayload,
		@Query() query: GetNotificationsQueryDto,
	): Promise<NotificationListResponseDto> {
		this.logger.debug(
			`알림 목록 조회: userId=${user.userId}, category=${query.category}`,
		);

		const [result, unreadCount] = await Promise.all([
			this.notificationService.getNotifications({
				userId: user.userId,
				cursor: query.cursor,
				size: query.limit,
				unreadOnly: query.unreadOnly,
				category: query.category,
			}),
			this.notificationService.getUnreadCount(user.userId),
		]);

		return {
			notifications: result.items,
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
	async getUnreadCount(
		@CurrentUser() user: CurrentUserPayload,
	): Promise<UnreadCountResponseDto> {
		const unreadCount = await this.notificationService.getUnreadCount(
			user.userId,
		);

		return { unreadCount };
	}

	// ============================================
	// 읽음 처리
	// ============================================

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
	async markAsRead(
		@CurrentUser() user: CurrentUserPayload,
		@Param("id", ParseIntPipe) id: number,
	): Promise<MarkReadResponseDto> {
		this.logger.debug(`알림 읽음 처리: userId=${user.userId}, id=${id}`);

		await this.notificationService.markAsRead(user.userId, id);

		return {
			message: "알림을 읽음 처리했습니다.",
			readCount: 1,
		};
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
	async markAllAsRead(
		@CurrentUser() user: CurrentUserPayload,
	): Promise<MarkReadResponseDto> {
		this.logger.debug(`모든 알림 읽음 처리: userId=${user.userId}`);

		const result = await this.notificationService.markAllAsRead(user.userId);

		return {
			message: "모든 알림을 읽음 처리했습니다.",
			readCount: result.count,
		};
	}
}
