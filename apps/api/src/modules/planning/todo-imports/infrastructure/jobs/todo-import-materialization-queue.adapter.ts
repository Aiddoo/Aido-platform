import { Injectable } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { TodoImportMaterializationQueuePort } from "../../application/ports/todo-import-materialization-queue.port.js";
import type { TodoImportId } from "../../domain/todo-import-id.vo.js";
import {
  TODO_IMPORT_MATERIALIZATION_QUEUE,
  todoImportMaterializationJobKey,
} from "./todo-import-materialization.queue.js";

@Injectable()
export class TodoImportMaterializationQueueAdapter extends TodoImportMaterializationQueuePort {
  readonly #jobQueue: JobQueuePort;

  constructor(jobQueue: JobQueuePort) {
    super();
    this.#jobQueue = jobQueue;
  }

  async enqueue(importId: TodoImportId, round: number): Promise<void> {
    const payload = { importId: importId.value, round };
    await this.#jobQueue.enqueue(TODO_IMPORT_MATERIALIZATION_QUEUE, payload, {
      idempotencyKey: todoImportMaterializationJobKey(payload),
    });
  }
}
