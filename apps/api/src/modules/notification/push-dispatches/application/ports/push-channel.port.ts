import type { PushChannel } from "../../../shared/domain/push-channel.constants.js";
import type { PushCategoryId } from "../../domain/push-category-id.vo.js";
import type { PushDeliveryPriority } from "../../domain/push-delivery-options.domain-service.js";
import type { PushFailureKind } from "../../domain/push-failure-kind.constants.js";
import type { PushReceiptTiming } from "../../domain/push-receipt.domain-service.js";
import type { PushTicketId } from "../../domain/push-ticket-id.vo.js";

// 받는 기기와 상관없는 알림 내용. 토큰마다 채널·토큰을 붙여 PushMessage가 된다
export interface PushMessageContent {
  readonly title: string;
  readonly body: string;
  readonly data?: Record<string, unknown>;
  readonly badge?: number;
  readonly sound?: "default" | null;
  readonly categoryId?: PushCategoryId;
  readonly priority: PushDeliveryPriority;
  readonly ttlSeconds: number;
}

export interface PushMessage extends PushMessageContent {
  readonly channel: PushChannel;
  readonly token: string;
}

export interface PushFailure {
  readonly kind: PushFailureKind;
  // 공급자 원본 코드. 판단에 쓰지 않고 진단 기록에만 남긴다
  readonly providerCode?: string;
  readonly message?: string;
}

export type PushSendResult =
  | { readonly token: string; readonly status: "accepted"; readonly ticketId: PushTicketId }
  | { readonly token: string; readonly status: "rejected"; readonly failure: PushFailure };

export type PushReceiptResult =
  | { readonly ticketId: PushTicketId; readonly status: "delivered" }
  | { readonly ticketId: PushTicketId; readonly status: "failed"; readonly failure: PushFailure };

// 채널이 정하는 시간. receipt 확인 구간과 처리 lease가 공급자 이름 없이 이 값을 쓴다
export interface PushChannelTiming {
  // 늦은 receipt가 없는 채널은 readyAfterMs 0으로 다음 확인 실행에서 바로 묻는다
  readonly receipt: PushReceiptTiming;
  // 전송 요청을 끊을 수 없어 delivery 작업이 만료된 뒤에도 요청이 이어질 수 있는 시간
  readonly unabortableSendGraceMs: number;
}

// 발송 채널(Expo, 이후 FCM·Web Push) 하나의 Strategy. 공급자 오류 어휘는 PushFailureKind로 바꿔 돌려준다
export abstract class PushChannelPort {
  abstract readonly channel: PushChannel;
  abstract readonly timing: PushChannelTiming;
  // 결과는 입력 순서와 같고, 공급자 수락 여부를 확인하지 못한 transport 실패는 RetryablePushProviderTransportError로 던진다
  abstract sendBatch(messages: readonly PushMessage[]): Promise<PushSendResult[]>;
  // 아직 결과가 없는 ticket은 결과에서 빠진다. 늦은 receipt가 없는 채널은 전송 때 안 결과를 바로 돌려준다
  abstract readReceipts(ticketIds: readonly PushTicketId[]): Promise<PushReceiptResult[]>;
  abstract acceptsToken(token: string): boolean;
}
