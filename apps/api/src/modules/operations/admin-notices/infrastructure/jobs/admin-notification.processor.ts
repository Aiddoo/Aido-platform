import { Injectable, type OnModuleInit } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { DispatchDailySignupSummaryUseCase } from "../../application/use-cases/dispatch-daily-signup-summary.use-case.js";
import { SendAdminNotificationUseCase } from "../../application/use-cases/send-admin-notification.use-case.js";
import {
  ADMIN_NOTIFICATION_QUEUE,
  AdminNotificationJobName,
  type AdminNotificationJob,
} from "./admin-notification.queue.js";

@Injectable()
export class AdminNotificationProcessor implements OnModuleInit {
  readonly #jobQueue: JobQueuePort;
  readonly #sendAdminNotification: SendAdminNotificationUseCase;
  readonly #dispatchDailySummary: DispatchDailySignupSummaryUseCase;

  constructor(
    jobQueue: JobQueuePort,
    sendAdminNotification: SendAdminNotificationUseCase,
    dispatchDailySummary: DispatchDailySignupSummaryUseCase,
  ) {
    this.#jobQueue = jobQueue;
    this.#sendAdminNotification = sendAdminNotification;
    this.#dispatchDailySummary = dispatchDailySummary;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.work(ADMIN_NOTIFICATION_QUEUE, async (jobs) => {
      for (const job of jobs) {
        await this.process(job.data);
      }
    });
  }

  async process(job: AdminNotificationJob): Promise<void> {
    if (job.name === AdminNotificationJobName.DISPATCH_SUMMARY) {
      await this.#dispatchDailySummary.execute();
      return;
    }
    await this.#sendAdminNotification.execute(job.data);
  }
}
