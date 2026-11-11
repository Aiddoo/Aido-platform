import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";

import { AdminNoticeLogEvent } from "../../application/admin-notices.log-events.js";
import { AdminEventNotifierPort } from "../../application/ports/admin-event-notifier.port.js";
import type { SubscriptionAlertInput } from "../../application/read-models/subscription-alert.read-model.js";
import type { UserRegisteredEventPayload } from "../../application/read-models/user-registered.read-model.js";
import type { EnqueueSubscriptionEventUseCase } from "../../application/use-cases/enqueue-subscription-event.use-case.js";
import type { EnqueueUserRegisteredUseCase } from "../../application/use-cases/enqueue-user-registered.use-case.js";

export interface AdminEventNotifierDependencies {
  readonly enqueueUserRegistered: Pick<EnqueueUserRegisteredUseCase, "execute">;
  readonly enqueueSubscriptionEvent: Pick<EnqueueSubscriptionEventUseCase, "execute">;
  readonly logger: Pick<ApplicationLoggerPort, "error">;
}

// 기다리지 않고 큐에 올린다. 등록이 실패해도 가입·결제 처리는 되돌리지 않고 로그만 남긴다
export class AdminEventNotifierAdapter extends AdminEventNotifierPort {
  readonly #dependencies: AdminEventNotifierDependencies;

  constructor(dependencies: AdminEventNotifierDependencies) {
    super();
    this.#dependencies = dependencies;
  }

  notifyUserRegistered(payload: UserRegisteredEventPayload): void {
    const { enqueueUserRegistered, logger } = this.#dependencies;
    enqueueUserRegistered.execute(payload).catch(() => {
      logger.error({
        event: AdminNoticeLogEvent.SIGNUP_ENQUEUE_FAILED,
        userId: payload.userId,
        errorType: "queue-enqueue",
      });
    });
  }

  notifySubscriptionEvent(payload: SubscriptionAlertInput): void {
    const { enqueueSubscriptionEvent, logger } = this.#dependencies;
    enqueueSubscriptionEvent.execute(payload).catch(() => {
      logger.error({
        event: AdminNoticeLogEvent.SUBSCRIPTION_ENQUEUE_FAILED,
        userId: payload.userId,
        errorType: "queue-enqueue",
      });
    });
  }
}
