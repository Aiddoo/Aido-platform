import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { ADMIN_NOTIFICATION_QUEUE } from "./admin-notification.queue.js";

/** 일일 가입 요약 스케줄(KST 00:10)을 등록한다. 작업 저장소 장애가 앱 기동을 막지 않도록 백그라운드로 돈다. */
@Injectable()
export class DailySignupSummaryScheduler implements OnModuleInit {
  readonly #logger = new Logger(DailySignupSummaryScheduler.name);
  readonly #jobQueue: JobQueuePort;

  /** 스케줄 등록 완료 프로미스(테스트 대기용). 절대 reject하지 않는다 */
  registration: Promise<void> = Promise.resolve();

  constructor(jobQueue: JobQueuePort) {
    this.#jobQueue = jobQueue;
  }

  onModuleInit(): void {
    this.registration = runInBackground(this.#logger, "daily-signup-summary-schedule", () =>
      this.#jobQueue.registerSchedules(ADMIN_NOTIFICATION_QUEUE),
    );
  }
}
