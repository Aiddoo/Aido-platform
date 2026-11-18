import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import { PlatformLogEvent } from "#api/platform/logging/platform.log-events";
import { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import {
  DomainEventPublisherPort,
  type AfterCommitEventSubscription,
  type PublishedDomainEvent,
} from "#api/shared/application/ports/domain-event-publisher.port";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { EventSubscriptionCatalog } from "./event-subscription.catalog.js";

// pg-boss 내장 publish/subscribe는 구독 조회가 트랜잭션 밖이고 구독자별 결정적 id를 못 써 코드 레지스트리로 나눠 보낸다
@Injectable()
export class FanOutDomainEventPublisher extends DomainEventPublisherPort {
  readonly #logger = new Logger(FanOutDomainEventPublisher.name);
  readonly #catalog: EventSubscriptionCatalog;
  readonly #jobQueue: Pick<JobQueuePort, "enqueue">;
  readonly #afterCommit: AfterCommitTaskRegistryPort;
  readonly #eventEmitter: Pick<EventEmitter2, "emitAsync">;

  constructor(
    catalog: EventSubscriptionCatalog,
    jobQueue: JobQueuePort,
    afterCommit: AfterCommitTaskRegistryPort,
    eventEmitter: EventEmitter2,
  ) {
    super();
    this.#catalog = catalog;
    this.#jobQueue = jobQueue;
    this.#afterCommit = afterCommit;
    this.#eventEmitter = eventEmitter;
  }

  async publish(events: readonly PublishedDomainEvent[]): Promise<void> {
    for (const event of events) {
      const subscriptions = this.#catalog.subscriptionsFor(event.eventName);
      if (subscriptions.length === 0) {
        continue;
      }
      const payload = event.toPayload();
      for (const subscription of subscriptions) {
        // 발행 쪽에서 먼저 parse해 계약이 어긋나면 트랜잭션째 실패시킨다
        const parsed = subscription.payloadSchema.parse(payload);
        if (subscription.delivery === "durable") {
          await this.#jobQueue.enqueue(subscription.queue, parsed, {
            idempotencyKey: `${event.eventId}:${subscription.name}`,
          });
        } else {
          // 합치기 key가 구독끼리 겹쳐 다른 일이 사라지지 않게 구독 이름을 앞에 붙인다
          const rawCoalesceKey = subscription.coalesceKey?.(parsed);
          this.#afterCommit.register(
            () => this.#deliverAfterCommit(event, subscription, parsed),
            rawCoalesceKey == null ? undefined : `${subscription.name}:${rawCoalesceKey}`,
          );
        }
      }
    }
  }

  async #deliverAfterCommit(
    event: PublishedDomainEvent,
    subscription: AfterCommitEventSubscription<object>,
    payload: object,
  ): Promise<void> {
    try {
      await this.#eventEmitter.emitAsync(subscription.name, payload);
    } catch (error) {
      this.#logger.error({
        event: PlatformLogEvent.DOMAIN_EVENT_PUBLISH_FAILED,
        eventName: event.eventName,
        subscription: subscription.name,
        errorType: toErrorType(error),
      });
    }
  }
}
