import type { PushReceiptCheckWindow } from "../../domain/push-receipt.domain-service.js";
import type { PushReceiptResult } from "./push-provider.port.js";

export interface InvalidPushToken {
  readonly token: string;
  readonly userId: string;
}

export abstract class PushReceiptRepositoryPort {
  // 아직 확인하지 않았거나 확인한 지 재확인 간격이 지난 ticket을 오래된 확인 순으로 고른다
  abstract findPendingTicketIds(window: PushReceiptCheckWindow, limit: number): Promise<string[]>;
  // 결과가 온 ticket은 종결하고 아직 결과가 없는 ticket은 확인 시각만 남긴다
  abstract recordPushReceipts(input: {
    readonly requestedTicketIds: readonly string[];
    readonly results: readonly PushReceiptResult[];
    readonly checkedAt: Temporal.Instant;
  }): Promise<InvalidPushToken[]>;
  // 보관 기간 안에 receipt가 오지 않은 ticket을 결과 미상으로 닫는다
  abstract expireUnreceipted(acceptedBefore: Temporal.Instant, limit: number): Promise<number>;
}
