import { Injectable } from "@nestjs/common";

import { TodoTimezoneRebaseQueueService } from "#api/modules/planning/todos/planning-todo-timezone-jobs.public";

import type { TodoTimezoneRebaseEnqueuerPort } from "../../application/ports/todo-timezone-rebase-enqueuer.port.js";

@Injectable()
export class TodoTimezoneRebaseEnqueuerAdapter implements TodoTimezoneRebaseEnqueuerPort {
  readonly #queue: TodoTimezoneRebaseQueueService;

  constructor(queue: TodoTimezoneRebaseQueueService) {
    this.#queue = queue;
  }

  enqueueRebase(userId: string, at: Date): Promise<void> {
    return this.#queue.enqueueRebase(userId, at);
  }
}
