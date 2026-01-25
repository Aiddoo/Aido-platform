import { ErrorCode } from "@aido/errors";
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
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

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

/**
 * Notification API 컨트롤러
 *
 * ## 🔔 알림 관리 API
 *
 * 푸시 알림 토큰 등록, 알림 목록 조회, 읽음 처리를 위한 API입니다.
 *
 * ### 푸시 토큰 관리
 * - POST /notifications/token - 푸시 토큰 등록
 * - DELETE /notifications/token - 푸시 토큰 해제
 *
 * ### 알림 조회
 * - GET /notifications - 알림 목록 조회
 * - GET /notifications/unread-count - 읽지 않은 알림 수 조회
 *
 * ### 읽음 처리
 * - PATCH /notifications/:id/read - 단일 알림 읽음 처리
 * - PATCH /notifications/read-all - 모든 알림 읽음 처리
 *
 * ---
 *
 * ## 📱 알림 링크 처리 가이드 (클라이언트용)
 *
 * ### 1. Internal Link (인앱 링크)
 *
 * `route` 필드에 Expo Router 경로가 포함됩니다.
 *
 * **예시:**
 * - `"/todos/123"` - 특정 할일 상세 페이지로 이동
 * - `"/friends/abc"` - 친구 프로필 페이지로 이동
 * - `"/friends/requests"` - 친구 요청 목록으로 이동
 * - `"/"` - 홈 화면으로 이동
 * - `null` - 이동 없음 (알림 확인만)
 *
 * **클라이언트 처리:**
 * ```typescript
 * if (notification.route) {
 *   router.push(notification.route);
 * }
 * ```
 *
 * ### 2. External Link (외부 링크)
 *
 * `metadata.externalUrl` 필드에 외부 URL이 포함됩니다.
 *
 * **예시:**
 * ```json
 * {
 *   "route": null,
 *   "metadata": {
 *     "externalUrl": "https://example.com/promotion"
 *   }
 * }
 * ```
 *
 * **클라이언트 처리:**
 * ```typescript
 * if (notification.metadata?.externalUrl) {
 *   Linking.openURL(notification.metadata.externalUrl);
 * }
 * ```
 *
 * ### 3. 알림 타입별 route 패턴
 *
 * | 알림 타입 | route 예시 | 설명 |
 * |----------|-----------|------|
 * | FOLLOW_NEW | `/friends/requests` | 친구 요청 목록 |
 * | FOLLOW_ACCEPTED | `/friends/{friendId}` | 친구 프로필 |
 * | NUDGE_RECEIVED | `/todos/{todoId}` | 해당 할일 |
 * | CHEER_RECEIVED | `/friends/{senderId}` | 응원 보낸 친구 |
 * | TODO_REMINDER | `/todos/{todoId}` | 마감 예정 할일 |
 * | FRIEND_COMPLETED | `/friends/{friendId}` | 완료한 친구 |
 * | DAILY_COMPLETE | `/` | 홈 화면 |
 */
@ApiTags(SWAGGER_TAGS.NOTIFICATIONS)
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationController {
	private readonly logger = new Logger(NotificationController.name);

	constructor(private readonly notificationService: NotificationService) {}

	// ============================================
	// 푸시 토큰 관리
	// ============================================

	@Post("token")
	@ApiDoc({
		summary: "푸시 토큰 등록",
		operationId: "registerPushToken",
		description: `
## 📱 푸시 토큰 등록

Expo 푸시 토큰을 서버에 등록합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 요청 본문
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| \`token\` | string | ✅ | Expo 푸시 토큰 (ExponentPushToken[...]) |
| \`deviceId\` | string | ❌ | 기기 고유 ID (선택) |

### 💡 동작 방식
1. 토큰 유효성 검증 (Expo 형식 확인)
2. 동일 deviceId의 기존 토큰이 있으면 갱신
3. 토큰을 활성 상태로 등록

### ⚠️ 에러 케이스
| 코드 | 상황 |
|------|------|
| NOTIFICATION_1001 | 유효하지 않은 Expo 푸시 토큰 형식 |
		`,
	})
	@ApiCreatedResponse({ type: RegisterTokenResponseDto })
	@ApiUnauthorizedError()
	@ApiBadRequestError(ErrorCode.NOTIFICATION_1001)
	async registerToken(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: RegisterPushTokenDto,
	): Promise<RegisterTokenResponseDto> {
		this.logger.debug(`푸시 토큰 등록: userId=${user.userId}`);

		await this.notificationService.registerPushToken({
			userId: user.userId,
			token: dto.token,
			deviceId: dto.deviceId,
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
		description: `
## 🔕 푸시 토큰 해제

등록된 푸시 토큰을 해제합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 🔍 쿼리 파라미터
| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| \`deviceId\` | string | ❌ | 특정 기기의 토큰만 해제 (없으면 모든 토큰 해제) |

### 💡 동작 방식
- deviceId 지정: 해당 기기의 토큰만 해제
- deviceId 미지정: 사용자의 모든 토큰 해제 (로그아웃 시)
		`,
	})
	@ApiSuccessResponse({ type: RegisterTokenResponseDto })
	@ApiUnauthorizedError()
	async unregisterToken(
		@CurrentUser() user: CurrentUserPayload,
		@Query("deviceId") deviceId?: string,
	): Promise<RegisterTokenResponseDto> {
		this.logger.debug(
			`푸시 토큰 해제: userId=${user.userId}, deviceId=${deviceId ?? "all"}`,
		);

		if (deviceId) {
			await this.notificationService.unregisterPushToken(user.userId, deviceId);
		} else {
			await this.notificationService.unregisterAllPushTokens(user.userId);
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
		description: `
## 📋 알림 목록 조회

사용자의 알림 목록을 커서 기반 페이지네이션으로 조회합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 🔍 쿼리 파라미터
| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| \`limit\` | number | 20 | 조회할 알림 수 (1-50) |
| \`cursor\` | number | - | 페이지네이션 커서 (마지막 알림 ID) |
| \`unreadOnly\` | boolean | false | 읽지 않은 알림만 조회 |

### 📤 응답 구조
\`\`\`json
{
  "notifications": [...],
  "unreadCount": 5,
  "hasMore": true,
  "nextCursor": 42
}
\`\`\`
		`,
	})
	@ApiSuccessResponse({ type: NotificationListResponseDto })
	@ApiUnauthorizedError()
	async getNotifications(
		@CurrentUser() user: CurrentUserPayload,
		@Query() query: GetNotificationsQueryDto,
	): Promise<NotificationListResponseDto> {
		this.logger.debug(`알림 목록 조회: userId=${user.userId}`);

		const result = await this.notificationService.getNotifications({
			userId: user.userId,
			cursor: query.cursor,
			size: query.limit,
			unreadOnly: query.unreadOnly,
		});

		const unreadCount = await this.notificationService.getUnreadCount(
			user.userId,
		);

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
		description: `
## 🔢 읽지 않은 알림 수 조회

사용자의 읽지 않은 알림 개수를 조회합니다.
앱 배지 카운트 갱신 등에 사용됩니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📤 응답 구조
\`\`\`json
{
  "unreadCount": 5
}
\`\`\`
		`,
	})
	@ApiSuccessResponse({ type: UnreadCountResponseDto })
	@ApiUnauthorizedError()
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
	@ApiDoc({
		summary: "단일 알림 읽음 처리",
		operationId: "markNotificationAsRead",
		description: `
## ✅ 단일 알림 읽음 처리

특정 알림을 읽음 상태로 변경합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 경로 파라미터
- \`id\`: 읽음 처리할 알림 ID (number)

### 💡 동작 방식
1. 알림 존재 및 소유권 확인
2. 이미 읽은 알림은 무시
3. 읽음 시각(readAt) 기록

### ⚠️ 에러 케이스
| 코드 | 상황 |
|------|------|
| NOTIFICATION_1004 | 알림을 찾을 수 없음 |
| NOTIFICATION_1005 | 다른 사용자의 알림에 접근 |
		`,
	})
	@ApiSuccessResponse({ type: MarkReadResponseDto })
	@ApiUnauthorizedError()
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
		description: `
## ✅ 모든 알림 읽음 처리

사용자의 모든 읽지 않은 알림을 읽음 상태로 변경합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📤 응답 구조
\`\`\`json
{
  "message": "모든 알림을 읽음 처리했습니다.",
  "readCount": 5
}
\`\`\`
		`,
	})
	@ApiSuccessResponse({ type: MarkReadResponseDto })
	@ApiUnauthorizedError()
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
