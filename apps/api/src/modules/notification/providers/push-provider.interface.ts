/**
 * Push Provider Interface
 *
 * 푸시 알림 제공자 추상화 (Strategy Pattern)
 * 현재: Expo Push Notifications
 * 향후: FCM (Firebase Cloud Messaging) 지원 가능
 */

/**
 * 푸시 알림 페이로드
 */
export interface PushPayload {
	/** 푸시 토큰 */
	token: string;
	/** 알림 제목 */
	title: string;
	/** 알림 본문 */
	body: string;
	/** 추가 데이터 (딥링크, 알림 타입 등) */
	data?: Record<string, unknown>;
	/** 뱃지 숫자 (iOS) */
	badge?: number;
	/** 알림 사운드 */
	sound?: "default" | null;
	/** 알림 채널 ID (Android) */
	channelId?: string;
	/** 알림 우선순위 */
	priority?: "default" | "normal" | "high";
	/** TTL (초) - 알림 만료 시간 */
	ttl?: number;
}

/**
 * 단일 푸시 발송 결과
 */
export interface PushResult {
	/** 발송 성공 여부 */
	success: boolean;
	/** 에러 메시지 (실패 시) */
	error?: string;
	/** 에러 코드 (실패 시) */
	errorCode?: string;
	/** 푸시 티켓 ID (Expo) */
	ticketId?: string;
}

/**
 * 배치 푸시 발송 결과
 */
export interface BatchPushResult {
	/** 전체 발송 수 */
	total: number;
	/** 성공 수 */
	successCount: number;
	/** 실패 수 */
	failureCount: number;
	/** 개별 결과 */
	results: PushResult[];
	/** 유효하지 않은 토큰 목록 (삭제 필요) */
	invalidTokens: string[];
}

/**
 * Push Provider Interface
 *
 * 모든 푸시 알림 제공자는 이 인터페이스를 구현해야 합니다.
 */
export interface PushProvider {
	/**
	 * 제공자 이름
	 */
	readonly name: string;

	/**
	 * 단일 푸시 알림 발송
	 */
	send(payload: PushPayload): Promise<PushResult>;

	/**
	 * 배치 푸시 알림 발송
	 * @param payloads 최대 100개 권장
	 */
	sendBatch(payloads: PushPayload[]): Promise<BatchPushResult>;

	/**
	 * 푸시 토큰 유효성 검증
	 */
	validateToken(token: string): boolean;
}

/**
 * Push Provider 토큰 (DI용)
 */
export const PUSH_PROVIDER = Symbol("PUSH_PROVIDER");
