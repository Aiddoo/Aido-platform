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
	/** iOS/Android interactive notification category */
	categoryId?: string;
	/** 알림 우선순위 */
	priority?: "default" | "normal" | "high";
	/** TTL (초) - 알림 만료 시간 */
	ttl?: number;
}

/**
 * 단일 푸시 발송 결과
 */
export interface PushResult {
	/** 결과가 대응하는 Expo 토큰 */
	token: string;
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

export interface PushReceiptResult {
	ticketId: string;
	delivered: boolean;
	errorCode?: string;
	error?: string;
}

/**
 * Provider transport가 중단된 시점의 배치 진행 상태.
 *
 * `acceptedTicketCountBeforeFailure`가 1 이상이면 이전 청크의 일부 알림은 이미
 * provider에 수락되었다. 호출자는 전체 논리 배치를 재시도하므로 해당 알림은
 * at-least-once 의미에 따라 중복 전달될 수 있다.
 */
export interface RetryablePushProviderTransportErrorMetadata {
	readonly providerName: string;
	/** 실패 전에 SDK 응답까지 처리한 payload 수 (성공·영구 실패 포함). */
	readonly resolvedPayloadCountBeforeFailure: number;
	/** 처리한 payload 중 provider가 성공 ticket을 반환한 수. */
	readonly acceptedTicketCountBeforeFailure: number;
	/** 전송 요청은 했지만 provider 수락 여부를 확인하지 못한 실패 청크의 payload 수. */
	readonly unconfirmedPayloadCount: number;
	/** 실패 청크 뒤에 남아 provider에 요청하지 않은 payload 수. */
	readonly unattemptedPayloadCount: number;
}

/** 일시적인 SDK/HTTP transport 실패를 queue retry 경계까지 보존하는 provider 오류. */
export class RetryablePushProviderTransportError extends Error {
	constructor(
		readonly metadata: RetryablePushProviderTransportErrorMetadata,
		options?: ErrorOptions,
	) {
		super(
			`Retryable push provider transport failure: provider=${metadata.providerName}, resolved=${metadata.resolvedPayloadCountBeforeFailure}, accepted=${metadata.acceptedTicketCountBeforeFailure}, unconfirmed=${metadata.unconfirmedPayloadCount}, unattempted=${metadata.unattemptedPayloadCount}`,
			options,
		);
		this.name = RetryablePushProviderTransportError.name;
	}
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
	 * @throws {RetryablePushProviderTransportError} SDK/HTTP transport 실패. 앞선 청크가
	 * 이미 수락되었을 수 있으므로 호출자는 at-least-once 재시도를 전제로 해야 한다.
	 */
	sendBatch(payloads: PushPayload[]): Promise<BatchPushResult>;

	getReceipts(ticketIds: string[]): Promise<PushReceiptResult[]>;

	/**
	 * 푸시 토큰 유효성 검증
	 */
	validateToken(token: string): boolean;
}

/**
 * Push Provider 토큰 (DI용)
 */
export const PUSH_PROVIDER = Symbol("PUSH_PROVIDER");
