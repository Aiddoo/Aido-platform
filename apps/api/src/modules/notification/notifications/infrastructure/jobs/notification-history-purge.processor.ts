import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { NotificationLogEvent } from "../../application/notifications.log-events.js";
import { PurgeNotificationHistoryUseCase } from "../../application/use-cases/purge-notification-history.use-case.js";
import { NOTIFICATION_HISTORY_PURGE_QUEUE } from "./notification-history-purge.queue.js";

@Injectable()
export class NotificationHistoryPurgeProcessor implements OnModuleInit {
  readonly #logger = new Logger(NotificationHistoryPurgeProcessor.name);

  readonly #purgeNotificationHistory: Pick<PurgeNotificationHistoryUseCase, "execute">;
  readonly #jobQueue: JobQueuePort;

  constructor(
    @Inject(PurgeNotificationHistoryUseCase)
    purgeNotificationHistory: Pick<PurgeNotificationHistoryUseCase, "execute">,
    jobQueue: JobQueuePort,
  ) {
    this.#purgeNotificationHistory = purgeNotificationHistory;
    this.#jobQueue = jobQueue;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.work(NOTIFICATION_HISTORY_PURGE_QUEUE, async () => this.process());
  }

  async process(): Promise<void> {
    try {
      await this.#purgeNotificationHistory.execute();
    } catch (error) {
      this.#logger.error({
        event: NotificationLogEvent.NOTIFICATION_HISTORY_PURGE_JOB_FAILED,
        errorType: toErrorType(error),
      });
      throw error;
    }
  }
}
