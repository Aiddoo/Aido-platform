import type { z } from "zod";

import type { DomainEvent } from "#api/shared/domain/model/domain-event";

import type { QueueDefinition } from "./job-queue.port.js";

export const DOMAIN_EVENT_PUBLISHER = Symbol("DOMAIN_EVENT_PUBLISHER");

export interface PublishedDomainEvent extends DomainEvent {
  readonly eventId: string;
  readonly occurredAt: Temporal.Instant;
  /** 구독 schema로 parse할 직렬화 값. Temporal 객체는 넣지 않고 toIsoString 문자열로 둔다. */
  toPayload(): Record<string, unknown>;
}

interface EventSubscriptionBase<TPayload extends object> {
  /** 멱등 key(`<eventId>:<name>`)의 일부라 바꾸면 같은 이벤트가 다시 전달된다. */
  readonly name: string;
  readonly eventName: string;
  readonly payloadSchema: z.ZodType<TPayload>;
}

/** 상태를 바꾸는 반응. 발행 트랜잭션에 구독 큐 작업으로 함께 커밋된다. */
export interface DurableEventSubscription<
  TPayload extends object,
> extends EventSubscriptionBase<TPayload> {
  readonly delivery: "durable";
  readonly queue: QueueDefinition<TPayload>;
}

/** 캐시 정리 전용. 커밋 뒤 in-process로 `name` 채널에 보내며 실패해도 다시 보내지 않는다. */
export interface AfterCommitEventSubscription<
  TPayload extends object,
> extends EventSubscriptionBase<TPayload> {
  readonly delivery: "after-commit";
}

export type EventSubscription<TPayload extends object> =
  | DurableEventSubscription<TPayload>
  | AfterCommitEventSubscription<TPayload>;

export function defineEventSubscription<TPayload extends object>(
  subscription: EventSubscription<TPayload>,
): EventSubscription<TPayload> {
  return subscription;
}

/**
 * 도메인 이벤트 발행 포트
 *
 * `publish`는 UoW 안에서 부른다. 구독마다 durable은 같은 트랜잭션의 큐 작업으로,
 * after-commit은 커밋 뒤 in-process 전달로 나뉜다.
 */
export abstract class DomainEventPublisherPort {
  abstract publish(events: readonly PublishedDomainEvent[]): Promise<void>;
}
