import type { SubscriptionEventPayload } from "#api/modules/billing/billing-subscriptions.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import type { UserRegisteredEventPayload } from "../../../domain/types/notifications/user-registered.payload.js";
import type { EnqueueSubscriptionEvent } from "../../use-cases/notifications/enqueue-subscription-event.use-case.js";
import type { EnqueueUserRegistered } from "../../use-cases/notifications/enqueue-user-registered.use-case.js";

/** 운영 흐름과 격리된 관리자 이벤트 알림 큐 진입점. */
interface AdminEventNotifierDependencies {
  readonly enqueueUserRegistered: EnqueueUserRegistered;
  readonly enqueueSubscriptionEvent: EnqueueSubscriptionEvent;
  readonly logger: ApplicationLogger;
}

export class AdminEventNotifier {
  readonly #dependencies: AdminEventNotifierDependencies;

  constructor(dependencies: AdminEventNotifierDependencies) {
    this.#dependencies = dependencies;
  }

  notifyUserRegistered(payload: UserRegisteredEventPayload): void {
    this.#dependencies.enqueueUserRegistered.execute(payload).catch((error) => {
      this.#dependencies.logger.error(
        `Failed to enqueue user-registered notification: userId=${payload.userId}, ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  notifySubscriptionEvent(payload: SubscriptionEventPayload): void {
    this.#dependencies.enqueueSubscriptionEvent.execute(payload).catch((error) => {
      this.#dependencies.logger.error(
        `Failed to enqueue subscription notification: userId=${payload.userId}, ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
    });
  }
}
