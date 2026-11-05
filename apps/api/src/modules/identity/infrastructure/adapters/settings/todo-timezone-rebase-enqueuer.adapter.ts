import { Injectable } from "@nestjs/common";

import { TodoTimezoneRebaseQueueService } from "#api/modules/planning/planning-todo-timezone-jobs.public";

import type { TodoTimezoneRebaseEnqueuerPort } from "../../../application/ports/settings/todo-timezone-rebase.enqueuer.port.js";

@Injectable()
export class TodoTimezoneRebaseEnqueuerAdapter implements TodoTimezoneRebaseEnqueuerPort {
  constructor(private readonly queue: TodoTimezoneRebaseQueueService) {}

  enqueueRebase(userId: string, at: Date): Promise<void> {
    return this.queue.enqueueRebase(userId, at);
  }
}
