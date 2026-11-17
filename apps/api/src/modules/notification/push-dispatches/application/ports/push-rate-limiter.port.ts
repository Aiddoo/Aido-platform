export interface GeneralPushRateLimitRequest {
  readonly dispatchId: number;
  readonly userId: string;
}

export interface EngagementPushRateLimitRequest extends GeneralPushRateLimitRequest {
  // 사용자 현지 날짜(YYYY-MM-DD)
  readonly localDate: string;
}

export interface PushRateLimitRequest extends GeneralPushRateLimitRequest {
  // 자동 참여 유도 푸시일 때만 사용자 현지 날짜(YYYY-MM-DD)를 준다
  readonly engagementLocalDate?: string;
}

// 사용자별 푸시 발송 빈도 제한(PostgreSQL·Redis·인메모리). 반환값 true는 제한을 넘어 발송을 막는다는 뜻이다
export abstract class PushRateLimiterPort {
  // 제한을 넘지 않았으면 카운터를 올린다(check-and-increment)
  abstract reserveGeneral(request: GeneralPushRateLimitRequest): Promise<boolean>;
  // 자동 참여 유도 푸시는 사용자 현지 날짜 기준 하루 2회, 최소 4시간 간격이다
  abstract reserveEngagement(request: EngagementPushRateLimitRequest): Promise<boolean>;
  // 반환 배열은 입력 순서를 지킨다
  abstract reserveBatch(requests: readonly PushRateLimitRequest[]): Promise<readonly boolean[]>;
}
