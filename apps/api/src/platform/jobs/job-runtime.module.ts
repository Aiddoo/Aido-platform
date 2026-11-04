import {
  Global,
  Inject,
  Injectable,
  Module,
  type OnApplicationBootstrap,
  type BeforeApplicationShutdown,
} from "@nestjs/common";

import type { JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import { JOB_RUNTIME } from "#api/shared/application/ports/job-runtime.port";

import { PgBossJobRuntimeAdapter, pgBossClientProvider } from "./pg-boss-job-runtime.adapter.js";

@Injectable()
export class JobRuntimeLifecycle implements OnApplicationBootstrap, BeforeApplicationShutdown {
  constructor(@Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.runtime.start();
  }

  async beforeApplicationShutdown(): Promise<void> {
    await this.runtime.stop();
  }
}

@Global()
@Module({
  providers: [
    pgBossClientProvider,
    PgBossJobRuntimeAdapter,
    { provide: JOB_RUNTIME, useExisting: PgBossJobRuntimeAdapter },
    JobRuntimeLifecycle,
  ],
  exports: [JOB_RUNTIME],
})
export class JobRuntimeModule {}
