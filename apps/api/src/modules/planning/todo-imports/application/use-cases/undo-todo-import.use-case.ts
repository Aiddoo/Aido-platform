import { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { RemoveTodosUseCase } from "#api/modules/planning/todos/planning-todos.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoImportId } from "../../domain/todo-import-id.vo.js";
import type { TodoImport } from "../../domain/todo-import.aggregate.js";
import { TODO_IMPORT_UNDO } from "../../domain/todo-imports.constants.js";
import type { TodoImportLinkRepositoryPort } from "../ports/todo-import-link.repository.port.js";
import type { TodoImportUndoQueuePort } from "../ports/todo-import-undo-queue.port.js";
import type { TodoImportRepositoryPort } from "../ports/todo-import.repository.port.js";
import { TodoImportLockKeys } from "../todo-imports.lock-keys.js";
import { TodoImportLogEvent } from "../todo-imports.log-events.js";

const BATCH_STATEMENT_TIMEOUT_MS = 20_000;

export interface UndoTodoImportCommand {
  readonly importId: string;
  readonly round: number;
  // 이 할 일 id 뒤부터 이어서 지운다. round의 처음이면 null이다
  readonly afterTodoId: number | null;
}

export type UndoTodoImportResult =
  | { readonly kind: "completed" }
  | { readonly kind: "continued"; readonly nextRound: number }
  | { readonly kind: "stopped" };

type BatchResult =
  | UndoTodoImportResult
  | { readonly kind: "batched"; readonly count: number; readonly lastTodoId: TodoId };

interface UndoProgress {
  readonly importId: TodoImportId;
  readonly round: number;
  readonly afterTodoId: TodoId | null;
  readonly startedAt: Temporal.Instant;
  readonly processedCount: number;
}

interface UndoTodoImportDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly todoImportRepository: Pick<TodoImportRepositoryPort, "findById" | "save">;
  readonly linkRepository: Pick<TodoImportLinkRepositoryPort, "listTodoIds" | "countByImportId">;
  readonly removeTodos: Pick<RemoveTodosUseCase, "execute">;
  readonly undoQueue: Pick<TodoImportUndoQueuePort, "enqueue">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/**
 * 가져온 할 일을 200개씩 지운다. 완료한 할 일은 남기고(RemoveTodosUseCase가 미완료만 지운다) 끝에 남은 링크 수를
 * 남긴 수로 센다. 링크는 할 일과 함께 지워지므로 다시 실행해도 이미 지운 할 일을 두 번 세지 않는다
 */
export class UndoTodoImportUseCase {
  readonly #dependencies: UndoTodoImportDependencies;

  constructor(dependencies: UndoTodoImportDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: UndoTodoImportCommand): Promise<UndoTodoImportResult> {
    const { todoImportRepository, unitOfWork, clock, logger } = this.#dependencies;
    const importId = TodoImportId.reconstitute(command.importId);
    const found = await todoImportRepository.findById(importId);
    if (found == null) {
      return { kind: "stopped" };
    }
    let progress: UndoProgress = {
      importId,
      round: command.round,
      afterTodoId: command.afterTodoId == null ? null : TodoId.reconstitute(command.afterTodoId),
      startedAt: clock.now(),
      processedCount: 0,
    };
    for (;;) {
      const current = progress;
      const result = await unitOfWork.run(() => this.#runBatch(found.userId, current), {
        statementTimeoutMs: BATCH_STATEMENT_TIMEOUT_MS,
      });
      if (result.kind !== "batched") {
        if (result.kind === "completed") {
          logger.log({ event: TodoImportLogEvent.UNDONE, importId: importId.value });
        }
        return result;
      }
      progress = {
        ...progress,
        afterTodoId: result.lastTodoId,
        processedCount: progress.processedCount + result.count,
      };
    }
  }

  async #runBatch(userId: UserId, progress: UndoProgress): Promise<BatchResult> {
    const { mutationLock, todoImportRepository, linkRepository, removeTodos, clock } =
      this.#dependencies;
    await mutationLock.acquire([TodoImportLockKeys.userImports(userId)]);
    const todoImport = await todoImportRepository.findById(progress.importId);
    if (!isUndoingRound(todoImport, progress.round)) {
      return { kind: "stopped" };
    }
    const now = clock.now();
    const todoIds = await linkRepository.listTodoIds({
      importId: progress.importId,
      afterTodoId: progress.afterTodoId,
      limit: TODO_IMPORT_UNDO.BATCH_SIZE,
    });
    if (todoIds.length > 0) {
      const removed = await removeTodos.execute({ userId, todoIds });
      todoImport.recordUndone(removed.todoCount, now);
    }
    const lastTodoId = todoIds.at(-1);
    if (lastTodoId == null || todoIds.length < TODO_IMPORT_UNDO.BATCH_SIZE) {
      todoImport.finishUndo(await linkRepository.countByImportId(progress.importId), now);
      await todoImportRepository.save(todoImport);
      return { kind: "completed" };
    }
    const processedCount = progress.processedCount + todoIds.length;
    if (isRoundBudgetSpent({ ...progress, processedCount }, now)) {
      return this.#continueInNextRound(todoImport, lastTodoId, now);
    }
    await todoImportRepository.save(todoImport);
    return { kind: "batched", count: todoIds.length, lastTodoId };
  }

  async #continueInNextRound(
    todoImport: TodoImport,
    lastTodoId: TodoId,
    now: Temporal.Instant,
  ): Promise<BatchResult> {
    todoImport.continueInNextRound(now);
    await this.#dependencies.todoImportRepository.save(todoImport);
    await this.#dependencies.undoQueue.enqueue({
      importId: todoImport.id,
      round: todoImport.round,
      afterTodoId: lastTodoId,
    });
    return { kind: "continued", nextRound: todoImport.round };
  }
}

function isUndoingRound(todoImport: TodoImport | null, round: number): todoImport is TodoImport {
  return todoImport?.status === "UNDOING" && todoImport.round === round;
}

function isRoundBudgetSpent(progress: UndoProgress, now: Temporal.Instant): boolean {
  const elapsedMs = now.epochMilliseconds - progress.startedAt.epochMilliseconds;
  return (
    progress.processedCount >= TODO_IMPORT_UNDO.ROUND_MAX_ITEMS ||
    elapsedMs >= TODO_IMPORT_UNDO.ROUND_MAX_DURATION_MS
  );
}
