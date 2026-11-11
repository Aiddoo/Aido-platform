import { Injectable, type OnModuleInit } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { PUSH_RECEIPTS_SCHEDULE_QUEUE } from "./notification.queue.js";

// 이벤트 발행과 따로 receipt 정리 예약을 소유한다
@Injectable()
export class PushReceiptScheduler implements OnModuleInit {
  readonly #jobQueue: JobQueuePort;

  constructor(jobQueue: JobQueuePort) {
    this.#jobQueue = jobQueue;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.registerSchedules(PUSH_RECEIPTS_SCHEDULE_QUEUE);
  }
}
