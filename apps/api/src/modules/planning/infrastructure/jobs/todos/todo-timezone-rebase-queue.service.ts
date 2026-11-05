import { Inject, Injectable } from "@nestjs/common";

import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import {
  TODO_TIMEZONE_REBASE_JOB_NAME,
  TODO_TIMEZONE_REBASE_JOB_POLICY,
  TODO_TIMEZONE_REBASE_QUEUE,
  TODO_TIMEZONE_REBASE_WINDOW_MS,
} from "./todo-timezone-rebase.queue.constants.js";

@Injectable()
export class TodoTimezoneRebaseQueueService {
  constructor(@Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort) {}

  /**
   * 시각 구간마다 사용자당 작업 하나다. 작업은 구간이 끝난 뒤에 시작하므로 그 구간의 어떤 변경도 놓치지 않고,
   * 실행 중에 온 변경은 다음 구간의 새 작업이 된다. 활성 트랜잭션이 있으면 시간대 변경과 함께 커밋된다.
   */
  async enqueueRebase(userId: string, at: Date): Promise<void> {
    const windowStart =
      Math.floor(at.getTime() / TODO_TIMEZONE_REBASE_WINDOW_MS) * TODO_TIMEZONE_REBASE_WINDOW_MS;
    await this.runtime.enqueue(
      TODO_TIMEZONE_REBASE_QUEUE,
      { name: TODO_TIMEZONE_REBASE_JOB_NAME, data: { userId } },
      {
        ...TODO_TIMEZONE_REBASE_JOB_POLICY,
        idempotencyKey: `todo-timezone-rebase_${userId}_${windowStart}`,
        startAfter: new Date(windowStart + TODO_TIMEZONE_REBASE_WINDOW_MS),
      },
    );
  }
}
