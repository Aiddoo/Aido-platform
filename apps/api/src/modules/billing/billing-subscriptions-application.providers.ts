import { Logger, type FactoryProvider } from "@nestjs/common";

import { UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { SUBSCRIPTION_CACHE } from "./application/ports/subscriptions/subscription-cache.port.js";
import { SUBSCRIPTION_EVENT_NOTIFIER } from "./application/ports/subscriptions/subscription-event-notifier.port.js";
import { SUBSCRIPTION_EVENT_RECEIPT_REPOSITORY } from "./application/ports/subscriptions/subscription-event-receipt.repository.port.js";
import { SUBSCRIPTION_USER_MUTATION_LOCK } from "./application/ports/subscriptions/subscription-user-mutation-lock.port.js";
import { SUBSCRIPTION_WEBHOOK_LOCK } from "./application/ports/subscriptions/subscription-webhook-lock.port.js";
import { SUBSCRIPTION_REPOSITORY } from "./application/ports/subscriptions/subscription.repository.port.js";
import { HandleWebhookEvent } from "./application/use-cases/subscriptions/handle-webhook-event.use-case.js";

export const handleWebhookEventProvider: FactoryProvider<HandleWebhookEvent> = {
  provide: HandleWebhookEvent,
  inject: [
    SUBSCRIPTION_REPOSITORY,
    SUBSCRIPTION_EVENT_RECEIPT_REPOSITORY,
    SUBSCRIPTION_USER_MUTATION_LOCK,
    UNIT_OF_WORK,
    SUBSCRIPTION_CACHE,
    SUBSCRIPTION_EVENT_NOTIFIER,
    SUBSCRIPTION_WEBHOOK_LOCK,
  ],
  useFactory: (
    subscriptionRepository: ConstructorParameters<
      typeof HandleWebhookEvent
    >[0]["subscriptionRepository"],
    receiptRepository: ConstructorParameters<typeof HandleWebhookEvent>[0]["receiptRepository"],
    userMutationLock: ConstructorParameters<typeof HandleWebhookEvent>[0]["userMutationLock"],
    unitOfWork: ConstructorParameters<typeof HandleWebhookEvent>[0]["unitOfWork"],
    cache: ConstructorParameters<typeof HandleWebhookEvent>[0]["cache"],
    notifier: ConstructorParameters<typeof HandleWebhookEvent>[0]["notifier"],
    webhookLock: ConstructorParameters<typeof HandleWebhookEvent>[0]["webhookLock"],
  ) =>
    new HandleWebhookEvent({
      subscriptionRepository,
      receiptRepository,
      userMutationLock,
      unitOfWork,
      cache,
      notifier,
      webhookLock,
      logger: new Logger(HandleWebhookEvent.name),
    }),
};
