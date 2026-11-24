import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { PurgeTodoImportsUseCase } from "../../application/use-cases/purge-todo-imports.use-case.js";
import { TODO_IMPORT_CLEANUP_QUEUE } from "./todo-import-cleanup.queue.js";

@Injectable()
export class TodoImportCleanupProcessor implements OnModuleInit {
  readonly #purge: Pick<PurgeTodoImportsUseCase, "execute">;
  readonly #jobQueue: JobQueuePort;

  constructor(
    @Inject(PurgeTodoImportsUseCase) purge: Pick<PurgeTodoImportsUseCase, "execute">,
    jobQueue: JobQueuePort,
  ) {
    this.#purge = purge;
    this.#jobQueue = jobQueue;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.work(TODO_IMPORT_CLEANUP_QUEUE, async () => this.process());
  }

  async process(): Promise<void> {
    await this.#purge.execute();
  }
}
