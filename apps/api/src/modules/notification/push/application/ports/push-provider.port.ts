import type { PushDeliveryPriority } from "../../domain/push-delivery-options.constants.js";
import type { PushFailureKind } from "../../domain/push-failure-kind.constants.js";
import type { PushReceiptTiming } from "../../domain/push-receipt.domain-service.js";

export interface PushPayload {
  readonly token: string;
  readonly title: string;
  readonly body: string;
  readonly data?: Record<string, unknown>;
  readonly badge?: number;
  readonly sound?: "default" | null;
  readonly channelId?: string;
  readonly categoryId?: string;
  readonly priority: PushDeliveryPriority;
  readonly ttlSeconds: number;
}

export interface PushFailure {
  readonly kind: PushFailureKind;
  /** 공급자 원본 코드. 판단에 쓰지 않고 진단 기록에만 남긴다. */
  readonly providerCode?: string;
  readonly message?: string;
}

export type PushResult =
  | { readonly token: string; readonly status: "accepted"; readonly ticketId: string }
  | { readonly token: string; readonly status: "rejected"; readonly failure: PushFailure };

export type PushReceiptResult =
  | { readonly ticketId: string; readonly status: "delivered" }
  | { readonly ticketId: string; readonly status: "failed"; readonly failure: PushFailure };

/**
 * `acceptedTicketCountBeforeFailure`가 1 이상이면 앞선 청크가 이미 공급자에 수락됐다.
 * 호출자는 논리 배치 전체를 다시 시도하므로 그 알림은 at-least-once로 중복 전달될 수 있다.
 */
export interface RetryablePushProviderTransportErrorMetadata {
  readonly providerName: string;
  readonly resolvedPayloadCountBeforeFailure: number;
  readonly acceptedTicketCountBeforeFailure: number;
  readonly unconfirmedPayloadCount: number;
  readonly unattemptedPayloadCount: number;
}

export class RetryablePushProviderTransportError extends Error {
  readonly metadata: RetryablePushProviderTransportErrorMetadata;

  constructor(metadata: RetryablePushProviderTransportErrorMetadata, options?: ErrorOptions) {
    super(
      `Retryable push provider transport failure: provider=${metadata.providerName}, resolved=${metadata.resolvedPayloadCountBeforeFailure}, accepted=${metadata.acceptedTicketCountBeforeFailure}, unconfirmed=${metadata.unconfirmedPayloadCount}, unattempted=${metadata.unattemptedPayloadCount}`,
      options,
    );
    this.name = RetryablePushProviderTransportError.name;
    this.metadata = metadata;
  }
}

/** 공급자가 정하는 시간. receipt 확인 구간과 처리 lease가 공급자 이름 없이 이 값을 쓴다. */
export interface PushProviderTiming {
  readonly receipt: PushReceiptTiming;
  /** 전송 요청을 끊을 수 없어 delivery 작업이 만료된 뒤에도 요청이 이어질 수 있는 시간 */
  readonly unabortableSendGraceMs: number;
}

// 채널 공급자(Expo, 이후 FCM·Web Push)가 구현한다. 공급자 오류 어휘는 PushFailureKind로 바꿔 돌려준다
export abstract class PushProviderPort {
  abstract readonly name: string;
  abstract readonly timing: PushProviderTiming;
  // 결과는 입력 순서와 같고, 공급자 수락 여부를 확인하지 못한 transport 실패는 RetryablePushProviderTransportError로 던진다
  abstract sendBatch(payloads: readonly PushPayload[]): Promise<PushResult[]>;
  // 공급자가 아직 결과를 만들지 않은 ticket은 결과에서 빠진다
  abstract getReceipts(ticketIds: readonly string[]): Promise<PushReceiptResult[]>;
  abstract validateToken(token: string): boolean;
}
