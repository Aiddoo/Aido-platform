import {
  Global,
  Inject,
  Injectable,
  Module,
  type OnApplicationBootstrap,
  type BeforeApplicationShutdown,
} from "@nestjs/common";

import { JOB_RUNTIME, JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import { PgBossJobRuntimeAdapter, pgBossClientProvider } from "./pg-boss-job-runtime.adapter.js";

@Injectable()
export class JobRuntimeLifecycle implements OnApplicationBootstrap, BeforeApplicationShutdown {
  readonly #runtime: JobRuntimePort;

  // 테스트가 옛 Symbol 토큰을 덮어써 runtime을 바꾸므로 Symbol로 주입한다
  constructor(@Inject(JOB_RUNTIME) runtime: JobRuntimePort) {
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
    { provide: JOB_RUNTIME, useExisting: PgBossJobRuntimeAdapter },
    // 옛 Symbol 토큰을 쓰는 Context가 모두 옮겨질 때까지 같은 인스턴스의 별칭이다
    { provide: JobRuntimePort, useExisting: JOB_RUNTIME },
    JobRuntimeLifecycle,
  ],
  exports: [JOB_RUNTIME, JobRuntimePort],
})
export class JobRuntimeModule {}
