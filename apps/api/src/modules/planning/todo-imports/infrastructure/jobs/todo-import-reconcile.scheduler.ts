import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { TODO_IMPORT_RECONCILE_QUEUE } from "./todo-import-reconcile.queue.js";

@Injectable()
export class TodoImportReconcileScheduler implements OnModuleInit {
  readonly #logger = new Logger(TodoImportReconcileScheduler.name);
  schedulerRegistration: Promise<void> = Promise.resolve();

  readonly #jobQueue: JobQueuePort;

  constructor(jobQueue: JobQueuePort) {
    this.#jobQueue = jobQueue;
  }

  onModuleInit(): void {
    // 큐 장애가 API 부팅을 막지 않도록 등록 완료를 백그라운드에서 기다린다
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Todo import reconcile scheduler registration",
      async () => {
        await this.#jobQueue.registerSchedules(TODO_IMPORT_RECONCILE_QUEUE);
      },
    );
  }
}
