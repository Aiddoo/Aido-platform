import type { PushDispatchStatus } from "../../domain/push-delivery-status.constants.js";

export interface DeleteFinishedPushDispatchesQuery {
  readonly status: PushDispatchStatus;
  readonly finishedBefore: Temporal.Instant;
  // 이 예약 시각부터 시간 순서로 찾는다. 남겨 두는 행을 묶음마다 다시 훑지 않는다
  readonly scheduledFrom: Temporal.Instant | null;
  readonly limit: number;
}

// 오래된 발송 기록을 한 문장에 limit개씩 지운다. 문장마다 따로 커밋된다
export abstract class PushDeliveryHistoryRepositoryPort {
  // 그 상태로 끝난 발송을 지운다. 기기 결과·outbox·한도 예약은 FK cascade로 함께 지워진다.
  // 관리자 캠페인 결과 화면이 세는 발송(campaignKey가 ADMIN_BROADCAST_CAMPAIGN_KEY_PREFIX로 시작)은 남겨 알림과 함께 지운다
  abstract deleteFinishedDispatches(query: DeleteFinishedPushDispatchesQuery): Promise<{
    readonly deletedCount: number;
    readonly lastScheduledAt: Temporal.Instant | null;
  }>;
  abstract deleteRateLimitReservations(query: {
    readonly reservedBefore: Temporal.Instant;
    readonly limit: number;
  }): Promise<number>;
}
