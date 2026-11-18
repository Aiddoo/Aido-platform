import { Injectable } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoTimezoneRebaseQueuePort } from "../../application/ports/todo-timezone-rebase-queue.port.js";
import {
  TODO_TIMEZONE_REBASE_QUEUE,
  TODO_TIMEZONE_REBASE_WINDOW_MS,
  toTodoTimezoneRebasePayload,
} from "./todo-timezone-rebase.queue.js";

@Injectable()
export class TodoTimezoneRebaseQueueAdapter extends TodoTimezoneRebaseQueuePort {
  readonly #jobQueue: JobQueuePort;

  constructor(jobQueue: JobQueuePort) {
    super();
    this.#jobQueue = jobQueue;
  }

  /**
   * 시각 구간마다 사용자당 작업 하나다. 작업은 구간이 끝난 뒤에 시작하므로 그 구간의 어떤 변경도 놓치지 않고,
   * 실행 중에 온 변경은 다음 구간의 새 작업이 된다. 활성 트랜잭션이 있으면 시간대 변경과 함께 커밋된다.
   */
  async enqueueRebase(user: UserId, at: Temporal.Instant): Promise<void> {
    const userId = user.value;
    const windowStart =
      Math.floor(at.epochMilliseconds / TODO_TIMEZONE_REBASE_WINDOW_MS) *
      TODO_TIMEZONE_REBASE_WINDOW_MS;
    await this.#jobQueue.enqueue(TODO_TIMEZONE_REBASE_QUEUE, toTodoTimezoneRebasePayload(userId), {
      idempotencyKey: `todo-timezone-rebase_${userId}_${windowStart}`,
      startAfter: Temporal.Instant.fromEpochMilliseconds(
        windowStart + TODO_TIMEZONE_REBASE_WINDOW_MS,
      ),
    });
  }
}
