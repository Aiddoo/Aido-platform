import {
  Global,
  Injectable,
  Module,
  type OnApplicationBootstrap,
  type BeforeApplicationShutdown,
} from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import { SweepCursorPort } from "#api/shared/application/ports/sweep-cursor.port";

import { DrizzleSweepCursorAdapter } from "./drizzle-sweep-cursor.adapter.js";
import { JobQueueRegistry } from "./job-queue.registry.js";
import { PgBossJobQueueAdapter } from "./pg-boss-job-queue.adapter.js";
import { PgBossJobRuntimeAdapter, pgBossClientProvider } from "./pg-boss-job-runtime.adapter.js";
import { PgBossScheduleRunReader } from "./pg-boss-schedule-run.reader.js";
import { ScheduleWatchdogProcessor } from "./schedule-watchdog.processor.js";
import { ScheduleWatchdogScheduler } from "./schedule-watchdog.scheduler.js";

@Injectable()
export class JobRuntimeLifecycle implements OnApplicationBootstrap, BeforeApplicationShutdown {
  readonly #runtime: JobRuntimePort;

  constructor(runtime: JobRuntimePort) {
    this.#runtime = runtime;
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.#runtime.start();
  }

  async beforeApplicationShutdown(): Promise<void> {
    await this.#runtime.stop();
  }
}

@Global()
@Module({
  providers: [
    pgBossClientProvider,
    PgBossJobRuntimeAdapter,
    { provide: JobRuntimePort, useExisting: PgBossJobRuntimeAdapter },
    // JobRuntimePort와 메서드 이름이 겹쳐 따로 구현하고, 같은 pg-boss client와 시작·종료를 공유한다
    PgBossJobQueueAdapter,
    { provide: JobQueuePort, useExisting: PgBossJobQueueAdapter },
    JobQueueRegistry,
    { provide: SweepCursorPort, useClass: DrizzleSweepCursorAdapter },
    JobRuntimeLifecycle,
    PgBossScheduleRunReader,
    ScheduleWatchdogProcessor,
    ScheduleWatchdogScheduler,
  ],
  exports: [JobRuntimePort, JobQueuePort, JobQueueRegistry, SweepCursorPort],
})
export class JobRuntimeModule {}
