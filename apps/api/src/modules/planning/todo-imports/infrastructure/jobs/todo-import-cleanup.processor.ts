import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { PurgeTodoImportsUseCase } from "../../application/use-cases/purge-todo-imports.use-case.js";
import { ReconcileTodoImportsUseCase } from "../../application/use-cases/reconcile-todo-imports.use-case.js";
import { TODO_IMPORT_CLEANUP_QUEUE } from "./todo-import-cleanup.queue.js";

@Injectable()
export class TodoImportCleanupProcessor implements OnModuleInit {
  readonly #reconcile: Pick<ReconcileTodoImportsUseCase, "execute">;
  readonly #purge: Pick<PurgeTodoImportsUseCase, "execute">;
  readonly #jobQueue: JobQueuePort;

  constructor(
    @Inject(ReconcileTodoImportsUseCase) reconcile: Pick<ReconcileTodoImportsUseCase, "execute">,
    @Inject(PurgeTodoImportsUseCase) purge: Pick<PurgeTodoImportsUseCase, "execute">,
    jobQueue: JobQueuePort,
  ) {
    this.#reconcile = reconcile;
    this.#purge = purge;
    this.#jobQueue = jobQueue;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.work(TODO_IMPORT_CLEANUP_QUEUE, async () => this.process());
  }

  // 재조정이 닫은 가져오기를 같은 실행의 정리가 바로 지우지 않게 재조정을 먼저 한다(정리는 7·30일 지난 것만 본다)
  async process(): Promise<void> {
    await this.#reconcile.execute();
    await this.#purge.execute();
  }
}
