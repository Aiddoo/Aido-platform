import {
  type EngagementPushRateLimitRequest,
  type GeneralPushRateLimitRequest,
  type PushRateLimitRequest,
  PushRateLimiterPort,
} from "#api/modules/notification/push/application/ports/push-rate-limiter.port";

// 정한 사용자만 제한에 걸린 것으로 답하고 받은 예약 요청을 남긴다
export class StubPushRateLimiter extends PushRateLimiterPort {
  readonly limitedGeneralUserIds = new Set<string>();
  readonly limitedEngagementUserIds = new Set<string>();
  readonly limitedBatchUserIds = new Set<string>();
  readonly generalRequests: GeneralPushRateLimitRequest[] = [];
  readonly engagementRequests: EngagementPushRateLimitRequest[] = [];
  readonly batchRequests: PushRateLimitRequest[][] = [];

  get reservationCount(): number {
    return this.generalRequests.length + this.engagementRequests.length + this.batchRequests.length;
  }

  async reserveGeneral(request: GeneralPushRateLimitRequest): Promise<boolean> {
    this.generalRequests.push(request);
    return this.limitedGeneralUserIds.has(request.userId);
  }

  async reserveEngagement(request: EngagementPushRateLimitRequest): Promise<boolean> {
    this.engagementRequests.push(request);
    return this.limitedEngagementUserIds.has(request.userId);
  }

  async reserveBatch(requests: readonly PushRateLimitRequest[]): Promise<readonly boolean[]> {
    this.batchRequests.push([...requests]);
    return requests.map((request) => this.limitedBatchUserIds.has(request.userId));
  }
}
