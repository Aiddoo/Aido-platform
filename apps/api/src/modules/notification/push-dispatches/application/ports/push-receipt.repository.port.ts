import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { PushChannel } from "../../../shared/domain/push-channel.constants.js";
import type { PushReceiptCheckWindow } from "../../domain/push-receipt.domain-service.js";
import type { PushTicketId } from "../../domain/push-ticket-id.vo.js";
import type { PushReceiptResult } from "./push-channel.port.js";

export interface InvalidPushToken {
  readonly token: string;
  readonly userId: UserId;
}

export abstract class PushReceiptRepositoryPort {
  // 그 채널로 보낸 ticket 중 아직 확인하지 않았거나 확인한 지 재확인 간격이 지난 것을 오래된 확인 순으로 고른다
  abstract findPendingTicketIds(query: {
    readonly channel: PushChannel;
    readonly window: PushReceiptCheckWindow;
    readonly limit: number;
  }): Promise<PushTicketId[]>;
  // 결과가 온 ticket은 종결하고 아직 결과가 없는 ticket은 확인 시각만 남긴다
  abstract recordPushReceipts(input: {
    readonly requestedTicketIds: readonly PushTicketId[];
    readonly results: readonly PushReceiptResult[];
    readonly checkedAt: Temporal.Instant;
  }): Promise<InvalidPushToken[]>;
  // 그 채널의 보관 기간 안에 receipt가 오지 않은 ticket을 결과 미상으로 닫는다
  abstract expireUnreceipted(command: {
    readonly channel: PushChannel;
    readonly acceptedBefore: Temporal.Instant;
    readonly limit: number;
  }): Promise<number>;
}
