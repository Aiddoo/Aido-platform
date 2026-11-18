import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { NotificationLogEvent } from "../../application/notifications.log-events.js";
import { NOTIFICATION_HISTORY_PURGE_QUEUE } from "./notification-history-purge.queue.js";

@Injectable()
export class NotificationHistoryPurgeScheduler implements OnModuleInit {
  readonly #logger = new Logger(NotificationHistoryPurgeScheduler.name);
  schedulerRegistration: Promise<void> = Promise.resolve();

  readonly #jobQueue: JobQueuePort;

  constructor(jobQueue: JobQueuePort) {
    this.#jobQueue = jobQueue;
  }

  onModuleInit(): void {
    // Queue 장애가 API 부팅을 막지 않도록 등록 완료를 백그라운드에서 기다린다
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Notification history purge scheduler registration",
      async () => {
        await this.#jobQueue.registerSchedules(NOTIFICATION_HISTORY_PURGE_QUEUE);
        this.#logger.log({
          event: NotificationLogEvent.NOTIFICATION_HISTORY_PURGE_SCHEDULER_REGISTERED,
        });
      },
    );
  }
}
