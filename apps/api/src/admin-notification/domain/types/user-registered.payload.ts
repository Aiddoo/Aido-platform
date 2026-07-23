/**
 * 관리자 알림 이벤트 페이로드 정의
 *
 * 회원가입 등 관리자 알림에 필요한 페이로드 타입을 정의합니다.
 * BullMQ AdminNotificationQueue에서 사용됩니다.
 */

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
