import type { NotificationActionType } from "@aido/validators";
import type { DatabaseService } from "@/database/database.service";
import type {
	Notification,
	Prisma,
	PushToken,
} from "@/generated/prisma/client";

/**
 * 트랜잭션 클라이언트 타입
 */
export type TransactionClient = Omit<
	DatabaseService,
	"$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * 알림 목록 조회 파라미터
 */
export interface FindNotificationsParams {
	userId: string;
	cursor?: number;
	size: number;
	unreadOnly?: boolean;
}

/**
 * 푸시 토큰 목록 조회 파라미터
 */
export interface FindPushTokensParams {
	userId: string;
	activeOnly?: boolean;
}

/**
 * 푸시 알림 액션 정보
 *
 * 푸시 알림 탭 시 수행할 액션을 정의합니다.
 * 기본값은 DEEP_LINK (앱 내부 이동, 클라이언트가 라우팅 결정)
 *
 * @example
 * // 외부 브라우저로 열기
 * { type: "BROWSER", url: "https://aido.kr/notice" }
 *
 * @example
 * // 인앱 웹뷰로 열기
 * { type: "WEBVIEW", url: "https://aido.kr/terms" }
 *
 * @example
 * // 앱 내부 이동 (기본값, 클라이언트가 type+context로 라우팅 결정)
 * { type: "DEEP_LINK" }
 */
export interface NotificationAction {
	/**
	 * 액션 타입
	 *
	 * | type | 용도 | url 필수 여부 |
	 * |------|------|---------------|
	 * | DEEP_LINK | 앱 내부 화면 이동 (기본값) | 선택 (없으면 클라이언트가 결정) |
	 * | BROWSER | 외부 브라우저로 열기 | 필수 |
	 * | WEBVIEW | 인앱 브라우저로 열기 | 필수 |
	 * | NONE | 액션 없음 (알림만 표시) | 불필요 |
	 */
	type: NotificationActionType;

	/**
	 * 액션 URL
	 *
	 * - BROWSER/WEBVIEW: 필수 (외부 URL)
	 * - DEEP_LINK: 선택 (없으면 클라이언트가 type+context로 결정)
	 * - NONE: 불필요
	 */
	url?: string;
}

/**
 * 알림 생성 데이터
 *
 * 푸시 알림을 생성하고 발송할 때 사용하는 데이터 구조입니다.
 * **클라이언트 중심 라우팅 방식**으로, 서버는 context만 전달하고
 * 클라이언트가 type + context 기반으로 라우트를 결정합니다.
 *
 * @example
 * // 기본 사용 (DEEP_LINK, 클라이언트가 라우트 결정)
 * {
 *   userId: "user-123",
 *   type: "FOLLOW_NEW",
 *   title: "새 친구 요청",
 *   body: "홍길동님이 친구 요청을 보냈어요",
 *   friendId: "friend-456",  // context로 전달
 * }
 *
 * @example
 * // 외부 브라우저로 열기 (BROWSER)
 * {
 *   userId: "user-123",
 *   type: "SYSTEM_NOTICE",
 *   title: "공지사항",
 *   body: "새로운 업데이트가 있습니다",
 *   action: { type: "BROWSER", url: "https://aido.kr/notice" },
 * }
 *
 * @example
 * // 인앱 웹뷰로 열기 (WEBVIEW)
 * {
 *   userId: "user-123",
 *   type: "SYSTEM_NOTICE",
 *   title: "이용약관 변경",
 *   body: "이용약관이 변경되었습니다",
 *   action: { type: "WEBVIEW", url: "https://aido.kr/terms" },
 * }
 */
export interface CreateNotificationData {
	/** 알림 수신 대상 사용자 ID */
	userId: string;

	/**
	 * 알림 타입
	 *
	 * 클라이언트가 이 타입을 기반으로 라우팅을 결정합니다.
	 *
	 * | 타입 | 설명 | 필요한 context |
	 * |------|------|----------------|
	 * | FOLLOW_NEW | 새 친구 요청 | friendId |
	 * | FOLLOW_ACCEPTED | 친구 요청 수락됨 | friendId |
	 * | NUDGE_RECEIVED | 독촉받음 | todoId?, friendId, nudgeId |
	 * | CHEER_RECEIVED | 응원받음 | friendId, cheerId |
	 * | DAILY_COMPLETE | 오늘 할일 전체 완료 | - |
	 * | FRIEND_COMPLETED | 친구가 할일 완료 | friendId |
	 * | TODO_REMINDER | 할일 리마인더 | todoId |
	 * | TODO_SHARED | 할일 공유됨 | todoId |
	 * | MORNING_REMINDER | 아침 리마인더 | - |
	 * | EVENING_REMINDER | 저녁 리마인더 | - |
	 * | WEEKLY_ACHIEVEMENT | 주간 달성 | - |
	 * | SYSTEM_NOTICE | 시스템 공지 | action.url 필요 |
	 */
	type: Prisma.NotificationCreateInput["type"];

	/** 알림 제목 (푸시 알림 타이틀) */
	title: string;

	/** 알림 본문 (푸시 알림 바디) */
	body: string;

	/**
	 * 푸시 알림 액션 (선택)
	 *
	 * 기본값: `{ type: "DEEP_LINK" }` (클라이언트가 type+context로 라우트 결정)
	 *
	 * | type | 용도 | url 필수 여부 |
	 * |------|------|---------------|
	 * | DEEP_LINK | 앱 내부 화면 이동 (기본값) | 선택 |
	 * | BROWSER | 외부 브라우저로 열기 | 필수 |
	 * | WEBVIEW | 인앱 브라우저로 열기 | 필수 |
	 * | NONE | 액션 없음 (알림만 표시) | 불필요 |
	 *
	 * @default { type: "DEEP_LINK" }
	 */
	action?: NotificationAction;

	/**
	 * 할일 ID (context)
	 *
	 * 사용 타입: TODO_REMINDER, TODO_SHARED, NUDGE_RECEIVED
	 * 클라이언트가 `/todos/{todoId}`로 라우팅 결정에 사용
	 */
	todoId?: number | null;

	/**
	 * 친구 ID (context)
	 *
	 * 사용 타입: FOLLOW_NEW, FOLLOW_ACCEPTED, NUDGE_RECEIVED,
	 *           CHEER_RECEIVED, FRIEND_COMPLETED
	 * 클라이언트가 `/friends/{friendId}`로 라우팅 결정에 사용
	 */
	friendId?: string | null;

	/**
	 * 독촉 ID (context)
	 *
	 * 사용 타입: NUDGE_RECEIVED
	 * 독촉 관련 추가 정보 조회에 사용
	 */
	nudgeId?: number | null;

	/**
	 * 응원 ID (context)
	 *
	 * 사용 타입: CHEER_RECEIVED
	 * 응원 메시지 조회에 사용
	 */
	cheerId?: number | null;

	/**
	 * 추가 메타데이터 (선택)
	 *
	 * DB에 저장되는 추가 정보. 알림 상세 조회 시 활용됩니다.
	 * 푸시 페이로드에는 포함되지 않습니다.
	 *
	 * @example
	 * // 응원 메시지가 있는 경우
	 * { message: "오늘도 파이팅!" }
	 *
	 * @example
	 * // 시스템 공지 관련 정보
	 * { noticeId: "notice-123", category: "update" }
	 */
	metadata?: Prisma.InputJsonValue | null;
}

/**
 * 푸시 토큰 등록 데이터
 */
export interface RegisterPushTokenData {
	userId: string;
	token: string;
	deviceId?: string;
	platform?: "IOS" | "ANDROID";
}

/**
 * 알림 with 관계 타입
 */
export type NotificationWithRelations = Notification;

/**
 * 푸시 토큰 with 관계 타입
 */
export type PushTokenWithRelations = PushToken;
