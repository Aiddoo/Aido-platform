import type { TodoImportStatus } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import type { TodoImport } from "../../domain/todo-import.aggregate.js";
import {
  TODO_IMPORT_RECOVERY,
  TODO_IMPORT_RETENTION,
  TODO_IMPORT_WORKING_STATUSES,
} from "../../domain/todo-imports.constants.js";
import type { TodoImportItemRepositoryPort } from "../ports/todo-import-item.repository.port.js";
import type { TodoImportMaterializationQueuePort } from "../ports/todo-import-materialization-queue.port.js";
import type { TodoImportUndoQueuePort } from "../ports/todo-import-undo-queue.port.js";
import type { TodoImportRepositoryPort } from "../ports/todo-import.repository.port.js";
import { TodoImportAlerts } from "../todo-imports.alerts.js";
import { TodoImportLockKeys } from "../todo-imports.lock-keys.js";
import { TodoImportLogEvent } from "../todo-imports.log-events.js";

export interface ReconciledTodoImports {
  readonly recoveredCount: number;
  readonly failedCount: number;
  readonly abandonedCount: number;
}

type StalledOutcome = "recovered" | "failed" | "skipped";

const UPLOADING = ["UPLOADING"] as const satisfies readonly TodoImportStatus[];

interface ReconcileTodoImportsDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly todoImportRepository: Pick<
    TodoImportRepositoryPort,
    "listStalled" | "findById" | "save"
  >;
  readonly itemRepository: Pick<TodoImportItemRepositoryPort, "deleteByImportId">;
  readonly materializationQueue: Pick<TodoImportMaterializationQueuePort, "enqueue">;
  readonly undoQueue: Pick<TodoImportUndoQueuePort, "enqueue">;
  readonly alert: Pick<OperationalAlertPort, "raise">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn">;
}

/**
 * 큐 작업을 잃어도 가져오기가 멈춘 채 남지 않게 10분마다 상태를 맞춘다. 상태는 DB에 있고 작업은 신호일 뿐이라
 * 10분 넘게 진행이 없는 작업 상태는 round를 올려 다시 넣고(최대 3번), 그래도 멈추면 FAILED와 경보를 남긴다.
 * 하루 넘게 업로드가 멈춘 가져오기는 ABANDONED로 닫고 받아 둔 일정을 지운다
 */
export class ReconcileTodoImportsUseCase {
  readonly #dependencies: ReconcileTodoImportsDependencies;

  constructor(dependencies: ReconcileTodoImportsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<ReconciledTodoImports> {
    const { todoImportRepository, clock } = this.#dependencies;
    const now = clock.now();
    const stalledBefore = now.subtract({ milliseconds: TODO_IMPORT_RECOVERY.STALLED_AFTER_MS });
    const stalled = await todoImportRepository.listStalled({
      statuses: TODO_IMPORT_WORKING_STATUSES,
      updatedBefore: stalledBefore,
      limit: TODO_IMPORT_RETENTION.PURGE_BATCH_SIZE,
    });
    const outcomes: StalledOutcome[] = [];
    for (const candidate of stalled) {
      outcomes.push(await this.#recover(candidate, stalledBefore));
    }
    const abandonedCount = await this.#abandonStalledUploads(
      now.subtract({ milliseconds: TODO_IMPORT_RECOVERY.UPLOAD_ABANDONED_AFTER_MS }),
    );
    return {
      recoveredCount: outcomes.filter((outcome) => outcome === "recovered").length,
      failedCount: outcomes.filter((outcome) => outcome === "failed").length,
      abandonedCount,
    };
  }

  async #recover(candidate: TodoImport, stalledBefore: Temporal.Instant): Promise<StalledOutcome> {
    const { unitOfWork, mutationLock, todoImportRepository, clock } = this.#dependencies;
    const outcome = await unitOfWork.run(async (): Promise<StalledOutcome> => {
      await mutationLock.acquire([TodoImportLockKeys.userImports(candidate.userId)]);
      const todoImport = await todoImportRepository.findById(candidate.id);
      if (
        todoImport == null ||
        !isStalledIn(todoImport, TODO_IMPORT_WORKING_STATUSES, stalledBefore)
      ) {
        return "skipped";
      }
      const now = clock.now();
      if (todoImport.recoveryCount >= TODO_IMPORT_RECOVERY.MAX_RECOVERY_COUNT) {
        todoImport.fail("STALLED", now);
        await todoImportRepository.save(todoImport);
        return "failed";
      }
      todoImport.recordRecovery(now);
      await todoImportRepository.save(todoImport);
      await this.#enqueue(todoImport);
      return "recovered";
    });
    this.#report(candidate, outcome);
    return outcome;
  }

  async #enqueue(todoImport: TodoImport): Promise<void> {
    if (todoImport.status === "UNDOING") {
      // 처음부터 다시 훑어도 지운 할 일은 링크가 없고 완료한 할 일은 다시 지우지 않는다
      await this.#dependencies.undoQueue.enqueue({
        importId: todoImport.id,
        round: todoImport.round,
        afterTodoId: null,
      });
      return;
    }
    await this.#dependencies.materializationQueue.enqueue(todoImport.id, todoImport.round);
  }

  #report(todoImport: TodoImport, outcome: StalledOutcome): void {
    const { logger, alert } = this.#dependencies;
    const importId = todoImport.id.value;
    match(outcome)
      .with("recovered", () => {
        logger.warn({ event: TodoImportLogEvent.RECOVERED, importId });
      })
      .with("failed", () => {
        logger.warn({ event: TodoImportLogEvent.FAILED, importId, reason: "STALLED" });
        alert.raise({ ...TodoImportAlerts.STALLED, details: { importId } });
      })
      .with("skipped", () => undefined)
      .exhaustive();
  }

  async #abandonStalledUploads(updatedBefore: Temporal.Instant): Promise<number> {
    const { unitOfWork, mutationLock, todoImportRepository, itemRepository, clock, logger } =
      this.#dependencies;
    const uploads = await todoImportRepository.listStalled({
      statuses: UPLOADING,
      updatedBefore,
      limit: TODO_IMPORT_RETENTION.PURGE_BATCH_SIZE,
    });
    let abandonedCount = 0;
    for (const candidate of uploads) {
      const isAbandoned = await unitOfWork.run(async () => {
        await mutationLock.acquire([TodoImportLockKeys.userImports(candidate.userId)]);
        const todoImport = await todoImportRepository.findById(candidate.id);
        if (todoImport == null || !isStalledIn(todoImport, UPLOADING, updatedBefore)) {
          return false;
        }
        todoImport.abandon(clock.now());
        await todoImportRepository.save(todoImport);
        await itemRepository.deleteByImportId(todoImport.id);
        return true;
      });
      abandonedCount += isAbandoned ? 1 : 0;
    }
    if (abandonedCount > 0) {
      logger.log({ event: TodoImportLogEvent.ABANDONED, abandonedCount });
    }
    return abandonedCount;
  }
}

// 고른 뒤 잠금을 잡는 사이에 작업이 진행했으면 건드리지 않는다
function isStalledIn(
  todoImport: TodoImport,
  statuses: readonly TodoImportStatus[],
  cutoff: Temporal.Instant,
): boolean {
  const { status, updatedAt } = todoImport.toPrimitives();
  return statuses.includes(status) && Temporal.Instant.compare(updatedAt, cutoff) < 0;
}
