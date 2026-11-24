import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { ReconcileTodoImportsUseCase } from "../../application/use-cases/reconcile-todo-imports.use-case.js";
import { TODO_IMPORT_RECONCILE_QUEUE } from "./todo-import-reconcile.queue.js";

@Injectable()
export class TodoImportReconcileProcessor implements OnModuleInit {
  readonly #reconcile: Pick<ReconcileTodoImportsUseCase, "execute">;
  readonly #jobQueue: JobQueuePort;

  constructor(
    @Inject(ReconcileTodoImportsUseCase) reconcile: Pick<ReconcileTodoImportsUseCase, "execute">,
    jobQueue: JobQueuePort,
  ) {
    this.#reconcile = reconcile;
    this.#jobQueue = jobQueue;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.work(TODO_IMPORT_RECONCILE_QUEUE, async () => this.process());
  }

  async process(): Promise<void> {
    await this.#reconcile.execute();
  }
}
