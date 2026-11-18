import { Injectable } from "@nestjs/common";

import { TodoTimezoneRebaseQueuePort } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoTimezoneRebaseEnqueuerPort } from "../../application/ports/todo-timezone-rebase-enqueuer.port.js";

@Injectable()
export class TodoTimezoneRebaseEnqueuerAdapter implements TodoTimezoneRebaseEnqueuerPort {
  readonly #queue: TodoTimezoneRebaseQueuePort;

  constructor(queue: TodoTimezoneRebaseQueuePort) {
    this.#queue = queue;
  }

  enqueueRebase(userId: UserId, at: Temporal.Instant): Promise<void> {
    return this.#queue.enqueueRebase(userId, at);
  }
}
