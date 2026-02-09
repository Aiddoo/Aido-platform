/**
 * 관리자 알림 이벤트 정의
 *
 * 관리자/운영용 외부 서비스 알림 이벤트.
 * 사용자 알림(NotificationEvents)과 분리하여 관심사를 명확히 합니다.
 *
 * @see apps/api/src/modules/notification/events/notification.events.ts
 */

export const AdminNotificationEvents = {
	USER_REGISTERED: "user.registered",
} as const;

/**
 * 회원가입 이벤트 페이로드
 */
export interface UserRegisteredEventPayload {
	/** 신규 사용자 ID */
	userId: string;
	/** 이메일 */
	email: string;
	/** 가입 방식 */
	provider: "credential" | "apple" | "google" | "kakao" | "naver";
	/** 가입 시각 (ISO string) */
	registeredAt: string;
}
