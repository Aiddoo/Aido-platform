import type { SubscriptionEnvironment } from "@aido/api/vocabulary";

import { Entity } from "#api/shared/domain/model/entity";

import type { ProviderEventId } from "./provider-event-id.vo.js";
import type { SubscriptionProvider } from "./subscriptions.constants.js";

export interface SubscriptionEventReceiptPrimitives {
  readonly provider: SubscriptionProvider;
  readonly eventId: string;
  readonly eventType: string;
  /** 웹훅이 보내지 않으면 null(알 수 없음)이다. */
  readonly environment: SubscriptionEnvironment | null;
  readonly processedAt: Temporal.Instant;
}

interface SubscriptionEventReceiptProps {
  readonly provider: SubscriptionProvider;
  readonly eventType: string;
  readonly environment: SubscriptionEnvironment | null;
  readonly processedAt: Temporal.Instant;
}

interface CreateSubscriptionEventReceiptParams {
  readonly provider: SubscriptionProvider;
  readonly eventId: ProviderEventId;
  readonly eventType: string;
  readonly environment: SubscriptionEnvironment | null;
  readonly now: Temporal.Instant;
}

/**
 * 반영한 공급자 이벤트 한 건(처리 원장 행). (공급자, 이벤트 ID)마다 한 번만 남아 재전송된 웹훅을 막고, 구독 변경과
 * 같은 트랜잭션에 기록돼 실패하면 함께 되돌아간다. 다시 읽지 않아 복원 팩토리가 없다.
 */
export class SubscriptionEventReceipt extends Entity<
  ProviderEventId,
  SubscriptionEventReceiptProps
> {
  static create(params: CreateSubscriptionEventReceiptParams): SubscriptionEventReceipt {
    return new SubscriptionEventReceipt(params.eventId, {
      provider: params.provider,
      eventType: params.eventType,
      environment: params.environment,
      processedAt: params.now,
    });
  }

  toPrimitives(): SubscriptionEventReceiptPrimitives {
    return {
      provider: this.props.provider,
      eventId: this.id.value,
      eventType: this.props.eventType,
      environment: this.props.environment,
      processedAt: this.props.processedAt,
    };
  }
}
