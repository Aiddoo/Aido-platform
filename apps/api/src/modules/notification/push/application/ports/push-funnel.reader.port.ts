import type { PushDispatchSkipReason } from "@aido/api/vocabulary";

import type { NotificationType } from "../../../inbox/domain/notification-type.constants.js";

export interface PushFunnelQuery {
  // 알림을 만든 시각 기준 [from, to) 구간의 알림만 센다
  readonly from: Temporal.Instant;
  readonly to: Temporal.Instant;
  readonly campaignKey: string | null;
  readonly notificationType: NotificationType | null;
}

// 단위는 알림(= 푸시 dispatch) 한 건이다. 기기가 여럿이어도 한 번만 센다
export interface PushFunnel {
  readonly created: number;
  // 어휘에 없는 옛 사유는 세지 않는다
  readonly skippedByReason: ReadonlyMap<PushDispatchSkipReason, number>;
  // 공급자에 보내 기기별 결과를 하나 이상 받은 알림
  readonly dispatchRequested: number;
  // 한 기기라도 receipt가 DELIVERED인 알림
  readonly receiptSucceeded: number;
  // DELIVERED 없이 FAILED receipt만 있는 알림
  readonly receiptFailed: number;
  // 앱이 푸시 탭으로 POST /notifications/{id}/opened를 기록한 알림(openedAt)
  readonly opened: number;
}

// 운영 지표용 푸시 발송 퍼널(생성 → 건너뜀 → 발송 요청 → receipt → 열람)
export abstract class PushFunnelReaderPort {
  abstract summarize(query: PushFunnelQuery): Promise<PushFunnel>;
}
