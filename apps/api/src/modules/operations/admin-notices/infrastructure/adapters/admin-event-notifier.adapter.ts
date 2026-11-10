import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";

import { AdminNoticeLogEvent } from "../../application/admin-notices.log-events.js";
import type { SubscriptionAlertInput } from "../../application/read-models/subscription-alert.read-model.js";
import type { UserRegisteredEventPayload } from "../../application/read-models/user-registered.read-model.js";
import type { EnqueueSubscriptionEventUseCase } from "../../application/use-cases/enqueue-subscription-event.use-case.js";
import type { EnqueueUserRegisteredUseCase } from "../../application/use-cases/enqueue-user-registered.use-case.js";

/** 운영 흐름과 격리된 관리자 이벤트 알림 큐 진입점. */
interface AdminEventNotifierDependencies {
  readonly enqueueUserRegistered: Pick<EnqueueUserRegisteredUseCase, "execute">;
  readonly enqueueSubscriptionEvent: Pick<EnqueueSubscriptionEventUseCase, "execute">;
  readonly logger: Pick<ApplicationLoggerPort, "error">;
}

export class AdminEventNotifier {
  readonly #dependencies: AdminEventNotifierDependencies;

  constructor(dependencies: AdminEventNotifierDependencies) {
    this.#dependencies = dependencies;
  }

  notifyUserRegistered(payload: UserRegisteredEventPayload): void {
    this.#dependencies.enqueueUserRegistered.execute(payload).catch(() => {
      this.#dependencies.logger.error({
        event: AdminNoticeLogEvent.SIGNUP_ENQUEUE_FAILED,
        userId: payload.userId,
        errorType: "queue-enqueue",
      });
    });
  }

  notifySubscriptionEvent(payload: SubscriptionAlertInput): void {
    this.#dependencies.enqueueSubscriptionEvent.execute(payload).catch(() => {
      this.#dependencies.logger.error({
        event: AdminNoticeLogEvent.SUBSCRIPTION_ENQUEUE_FAILED,
        userId: payload.userId,
        errorType: "queue-enqueue",
      });
    });
  }
}
