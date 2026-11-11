import type { FactoryProvider, ValueProvider } from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";
import { groupBy } from "es-toolkit";

import type { EventSubscription } from "#api/shared/application/ports/domain-event-publisher.port";

type AnyEventSubscription = EventSubscription<object>;

class EventSubscriptionSet {
  readonly subscriptions: readonly AnyEventSubscription[];

  constructor(subscriptions: readonly AnyEventSubscription[]) {
    this.subscriptions = subscriptions;
  }
}

/** slice module의 providers에 넣는다. 조립 때 EventSubscriptionCatalog가 모든 module에서 모은다. */
export function provideEventSubscriptions(
  ...subscriptions: readonly AnyEventSubscription[]
): ValueProvider<EventSubscriptionSet> {
  return {
    provide: Symbol("EVENT_SUBSCRIPTIONS"),
    useValue: new EventSubscriptionSet(subscriptions),
  };
}

export class EventSubscriptionCatalog {
  readonly #byEventName: Readonly<Record<string, readonly AnyEventSubscription[]>>;

  constructor(subscriptions: readonly AnyEventSubscription[]) {
    const names = new Set<string>();
    for (const { name } of subscriptions) {
      // 이름이 멱등 key라 겹치면 두 구독 중 하나의 작업이 조용히 사라진다
      if (names.has(name)) {
        throw new Error(`Duplicate event subscription name: ${name}`);
      }
      names.add(name);
    }
    this.#byEventName = groupBy(subscriptions, (subscription) => subscription.eventName);
  }

  subscriptionsFor(eventName: string): readonly AnyEventSubscription[] {
    return this.#byEventName[eventName] ?? [];
  }
}

export const eventSubscriptionCatalogProvider: FactoryProvider<EventSubscriptionCatalog> = {
  provide: EventSubscriptionCatalog,
  inject: [DiscoveryService],
  useFactory: (discovery: DiscoveryService) =>
    new EventSubscriptionCatalog(
      discovery
        .getProviders()
        .flatMap(({ instance }: { instance: unknown }) =>
          instance instanceof EventSubscriptionSet ? instance.subscriptions : [],
        ),
    ),
};
