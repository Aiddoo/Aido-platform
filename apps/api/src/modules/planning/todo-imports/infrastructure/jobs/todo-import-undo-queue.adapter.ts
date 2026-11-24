import { Injectable } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import {
  TodoImportUndoQueuePort,
  type TodoImportUndoRound,
} from "../../application/ports/todo-import-undo-queue.port.js";
import { TODO_IMPORT_UNDO_QUEUE, todoImportUndoJobKey } from "./todo-import-undo.queue.js";

@Injectable()
export class TodoImportUndoQueueAdapter extends TodoImportUndoQueuePort {
  readonly #jobQueue: JobQueuePort;

  constructor(jobQueue: JobQueuePort) {
    super();
    this.#jobQueue = jobQueue;
  }

  async enqueue(round: TodoImportUndoRound): Promise<void> {
    const payload = {
      importId: round.importId.value,
      round: round.round,
      afterTodoId: round.afterTodoId?.value ?? null,
    };
    await this.#jobQueue.enqueue(TODO_IMPORT_UNDO_QUEUE, payload, {
      idempotencyKey: todoImportUndoJobKey(payload),
      executionKey: payload.importId,
    });
  }
}
