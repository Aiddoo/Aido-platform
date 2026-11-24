import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { TodoImportAlerts } from "../../application/todo-imports.alerts.js";
import { TodoImportLogEvent } from "../../application/todo-imports.log-events.js";
import { FailTodoImportUseCase } from "../../application/use-cases/fail-todo-import.use-case.js";
import { UndoTodoImportUseCase } from "../../application/use-cases/undo-todo-import.use-case.js";
import { TODO_IMPORT_UNDO_QUEUE, type TodoImportUndoPayload } from "./todo-import-undo.queue.js";

@Injectable()
export class TodoImportUndoProcessor implements OnModuleInit {
  readonly #logger = new Logger(TodoImportUndoProcessor.name);
  readonly #undo: Pick<UndoTodoImportUseCase, "execute">;
  readonly #failImport: Pick<FailTodoImportUseCase, "execute">;
  readonly #alert: OperationalAlertPort;
  readonly #jobQueue: JobQueuePort;

  constructor(
    @Inject(UndoTodoImportUseCase) undo: Pick<UndoTodoImportUseCase, "execute">,
    @Inject(FailTodoImportUseCase) failImport: Pick<FailTodoImportUseCase, "execute">,
    alert: OperationalAlertPort,
    jobQueue: JobQueuePort,
  ) {
    this.#undo = undo;
    this.#failImport = failImport;
    this.#alert = alert;
    this.#jobQueue = jobQueue;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.work(TODO_IMPORT_UNDO_QUEUE, async (jobs) => {
      for (const job of jobs) {
        await this.process(job.data, job.attempt);
      }
    });
  }

  async process(payload: TodoImportUndoPayload, attempt: number): Promise<void> {
    try {
      await this.#undo.execute(payload);
    } catch (error) {
      const errorType = toErrorType(error);
      this.#logger.warn({
        event: TodoImportLogEvent.ATTEMPT_FAILED,
        queue: TODO_IMPORT_UNDO_QUEUE.name,
        importId: payload.importId,
        round: payload.round,
        attempt,
        errorType,
      });
      if (attempt > TODO_IMPORT_UNDO_QUEUE.retry.retryLimit) {
        await this.#failImport.execute({ importId: payload.importId, reason: "UNDO_FAILED" });
        this.#alert.raise({
          ...TodoImportAlerts.JOB_FAILED,
          subject: TODO_IMPORT_UNDO_QUEUE.name,
          details: { importId: payload.importId, attempt, errorType },
        });
      }
      throw error;
    }
  }
}
