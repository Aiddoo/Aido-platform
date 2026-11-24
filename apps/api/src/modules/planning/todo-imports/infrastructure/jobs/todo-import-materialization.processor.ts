import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { TodoImportAlerts } from "../../application/todo-imports.alerts.js";
import { TodoImportLogEvent } from "../../application/todo-imports.log-events.js";
import { FailTodoImportUseCase } from "../../application/use-cases/fail-todo-import.use-case.js";
import { MaterializeTodoImportUseCase } from "../../application/use-cases/materialize-todo-import.use-case.js";
import {
  TODO_IMPORT_MATERIALIZATION_QUEUE,
  type TodoImportMaterializationPayload,
} from "./todo-import-materialization.queue.js";

@Injectable()
export class TodoImportMaterializationProcessor implements OnModuleInit {
  readonly #logger = new Logger(TodoImportMaterializationProcessor.name);
  readonly #materialize: Pick<MaterializeTodoImportUseCase, "execute">;
  readonly #failImport: Pick<FailTodoImportUseCase, "execute">;
  readonly #alert: OperationalAlertPort;
  readonly #jobQueue: JobQueuePort;

  constructor(
    @Inject(MaterializeTodoImportUseCase) materialize: Pick<
      MaterializeTodoImportUseCase,
      "execute"
    >,
    @Inject(FailTodoImportUseCase) failImport: Pick<FailTodoImportUseCase, "execute">,
    alert: OperationalAlertPort,
    jobQueue: JobQueuePort,
  ) {
    this.#materialize = materialize;
    this.#failImport = failImport;
    this.#alert = alert;
    this.#jobQueue = jobQueue;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.work(TODO_IMPORT_MATERIALIZATION_QUEUE, async (jobs) => {
      for (const job of jobs) {
        await this.process(job.data, job.attempt);
      }
    });
  }

  async process(payload: TodoImportMaterializationPayload, attempt: number): Promise<void> {
    try {
      await this.#materialize.execute(payload);
    } catch (error) {
      const errorType = toErrorType(error);
      this.#logger.warn({
        event: TodoImportLogEvent.ATTEMPT_FAILED,
        queue: TODO_IMPORT_MATERIALIZATION_QUEUE.name,
        importId: payload.importId,
        round: payload.round,
        attempt,
        errorType,
      });
      if (attempt > TODO_IMPORT_MATERIALIZATION_QUEUE.retry.retryLimit) {
        // 재시도가 끝났다. 상태는 DB에 남아 있어 dead letter 큐 대신 FAILED로 멈추고 사람이 본다
        await this.#failImport.execute({
          importId: payload.importId,
          reason: "MATERIALIZATION_FAILED",
        });
        this.#alert.raise({
          ...TodoImportAlerts.JOB_FAILED,
          subject: TODO_IMPORT_MATERIALIZATION_QUEUE.name,
          details: { importId: payload.importId, attempt, errorType },
        });
      }
      throw error;
    }
  }
}
