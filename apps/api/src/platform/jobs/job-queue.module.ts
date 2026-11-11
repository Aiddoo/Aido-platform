import {
  Global,
  Injectable,
  Module,
  type OnApplicationBootstrap,
  type BeforeApplicationShutdown,
} from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { SweepCursorPort } from "#api/shared/application/ports/sweep-cursor.port";

import { DrizzleSweepCursorAdapter } from "./drizzle-sweep-cursor.adapter.js";
import { JobQueueRegistry } from "./job-queue.registry.js";
import { pgBossClientProvider } from "./pg-boss-client.js";
import { PgBossJobQueueAdapter } from "./pg-boss-job-queue.adapter.js";
import { PgBossScheduleRunReader } from "./pg-boss-schedule-run.reader.js";
import { ScheduleWatchdogProcessor } from "./schedule-watchdog.processor.js";
import { ScheduleWatchdogScheduler } from "./schedule-watchdog.scheduler.js";

@Injectable()
export class JobQueueLifecycle implements OnApplicationBootstrap, BeforeApplicationShutdown {
  readonly #jobQueue: Pick<JobQueuePort, "start" | "stop">;

  // 테스트가 포트를 메모리 구현으로 덮어써도 같은 수명주기를 타도록 어댑터가 아닌 포트를 받는다
  constructor(jobQueue: JobQueuePort) {
    this.#jobQueue = jobQueue;
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.#jobQueue.start();
  }

  async beforeApplicationShutdown(): Promise<void> {
    await this.#jobQueue.stop();
  }
}

@Global()
@Module({
  providers: [
    pgBossClientProvider,
    PgBossJobQueueAdapter,
    { provide: JobQueuePort, useExisting: PgBossJobQueueAdapter },
    JobQueueRegistry,
    { provide: SweepCursorPort, useClass: DrizzleSweepCursorAdapter },
    JobQueueLifecycle,
    PgBossScheduleRunReader,
    ScheduleWatchdogProcessor,
    ScheduleWatchdogScheduler,
  ],
  exports: [JobQueuePort, JobQueueRegistry, SweepCursorPort],
})
export class JobQueueModule {}
