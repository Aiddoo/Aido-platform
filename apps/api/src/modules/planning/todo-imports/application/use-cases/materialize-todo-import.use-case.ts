import { countBy, partition } from "es-toolkit";
import { match } from "ts-pattern";

import {
  TodoCategoryId,
  TodoCategoryLockKeys,
} from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import {
  type StagedTodoBatchCreatorPort,
  type TodoBatchDraft,
  type TodoBatchOutcome,
  TodoLockKeys,
} from "#api/modules/planning/todos/planning-todos.public";
import type { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { TodoImportId } from "../../domain/todo-import-id.vo.js";
import type { TodoImportItem } from "../../domain/todo-import-item.vo.js";
import { earlierDate } from "../../domain/todo-import-range.domain-service.js";
import type { TodoImport } from "../../domain/todo-import.aggregate.js";
import {
  TODO_IMPORT_MATERIALIZATION,
  type TodoImportItemOutcome,
} from "../../domain/todo-imports.constants.js";
import type { TodoImportItemRepositoryPort } from "../ports/todo-import-item.repository.port.js";
import type { TodoImportLinkRepositoryPort } from "../ports/todo-import-link.repository.port.js";
import type { TodoImportMaterializationQueuePort } from "../ports/todo-import-materialization-queue.port.js";
import type { TodoImportRepositoryPort } from "../ports/todo-import.repository.port.js";
import { TodoImportLockKeys } from "../todo-imports.lock-keys.js";
import { TodoImportLogEvent } from "../todo-imports.log-events.js";

// 앱 풀 기본 상한(15초)보다 넉넉히 두되 클라이언트 query_timeout(20초)을 넘지 않는다
const BATCH_STATEMENT_TIMEOUT_MS = 20_000;

export interface MaterializeTodoImportCommand {
  readonly importId: string;
  readonly round: number;
}

export type MaterializeTodoImportResult =
  | { readonly kind: "completed" }
  | { readonly kind: "continued"; readonly nextRound: number }
  // 가져오기가 없거나(계정 삭제), 할 일을 만드는 상태가 아니거나, 이미 다른 round로 넘어갔다
  | { readonly kind: "stopped" };

type BatchResult =
  | MaterializeTodoImportResult
  | { readonly kind: "batched"; readonly count: number };

interface RoundProgress {
  readonly importId: TodoImportId;
  readonly round: number;
  readonly startedAt: Temporal.Instant;
  readonly processedCount: number;
}

interface MaterializeTodoImportDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly todoImportRepository: Pick<TodoImportRepositoryPort, "findById" | "save">;
  readonly itemRepository: Pick<TodoImportItemRepositoryPort, "listPending" | "markOutcomes">;
  readonly linkRepository: Pick<
    TodoImportLinkRepositoryPort,
    "listLinkedSourceKeys" | "insertMany"
  >;
  readonly batchCreator: Pick<StagedTodoBatchCreatorPort, "stageMany">;
  readonly afterCommit: Pick<AfterCommitTaskRegistryPort, "register">;
  readonly materializationQueue: Pick<TodoImportMaterializationQueuePort, "enqueue">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/**
 * 받은 일정을 가까운 날짜부터 100개씩 할 일로 만든다. 묶음 하나가 트랜잭션 하나이고 묶음마다 상태를 다시 읽는다.
 * round 예산(60초·1,000개)을 쓰면 다음 round 작업을 마지막 묶음과 같은 트랜잭션에 넣고 큐 뒤로 간다.
 * 다시 실행해도 PENDING만 처리하고 링크 유니크가 막아 같은 일정이 두 번 만들어지지 않는다
 */
export class MaterializeTodoImportUseCase {
  readonly #dependencies: MaterializeTodoImportDependencies;

  constructor(dependencies: MaterializeTodoImportDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: MaterializeTodoImportCommand): Promise<MaterializeTodoImportResult> {
    const { todoImportRepository, unitOfWork, clock } = this.#dependencies;
    const importId = TodoImportId.reconstitute(command.importId);
    const found = await todoImportRepository.findById(importId);
    if (found == null) {
      return { kind: "stopped" };
    }
    let progress: RoundProgress = {
      importId,
      round: command.round,
      startedAt: clock.now(),
      processedCount: 0,
    };
    for (;;) {
      const current = progress;
      const result = await unitOfWork.run(() => this.#runBatch(found.userId, current), {
        statementTimeoutMs: BATCH_STATEMENT_TIMEOUT_MS,
      });
      if (result.kind !== "batched") {
        this.#logEnd(found, result);
        return result;
      }
      progress = { ...progress, processedCount: progress.processedCount + result.count };
    }
  }

  async #runBatch(userId: TodoImport["userId"], progress: RoundProgress): Promise<BatchResult> {
    const { mutationLock, todoImportRepository, itemRepository, materializationQueue, clock } =
      this.#dependencies;
    // 잠금 순서는 가져오기 → 카테고리 → 정렬이다. 할 일 만들기는 뒤의 둘만 잡아 서로 엇갈리지 않는다
    await mutationLock.acquire([TodoImportLockKeys.userImports(userId)]);
    await mutationLock.acquire([
      TodoCategoryLockKeys.userCategories(userId.value),
      TodoLockKeys.sortOrder(userId.value),
    ]);
    const todoImport = await todoImportRepository.findById(progress.importId);
    if (!isMaterializingRound(todoImport, progress.round)) {
      return { kind: "stopped" };
    }
    const now = clock.now();
    todoImport.start(now);
    // 하나 더 읽어 남은 일정이 없음을 같은 트랜잭션에서 알아 빈 묶음 트랜잭션을 한 번 덜 연다
    const pending = await itemRepository.listPending(
      progress.importId,
      TODO_IMPORT_MATERIALIZATION.BATCH_SIZE + 1,
    );
    const items = pending.slice(0, TODO_IMPORT_MATERIALIZATION.BATCH_SIZE);
    if (items.length > 0) {
      await this.#materialize(todoImport, items, now);
    }
    if (pending.length <= TODO_IMPORT_MATERIALIZATION.BATCH_SIZE) {
      todoImport.complete(now);
      await todoImportRepository.save(todoImport);
      return { kind: "completed" };
    }
    if (
      isRoundBudgetSpent(
        { ...progress, processedCount: progress.processedCount + items.length },
        now,
      )
    ) {
      todoImport.continueInNextRound(now);
      await todoImportRepository.save(todoImport);
      await materializationQueue.enqueue(todoImport.id, todoImport.round);
      return { kind: "continued", nextRound: todoImport.round };
    }
    await todoImportRepository.save(todoImport);
    return { kind: "batched", count: items.length };
  }

  async #materialize(
    todoImport: TodoImport,
    items: readonly TodoImportItem[],
    now: Temporal.Instant,
  ): Promise<void> {
    const { linkRepository, itemRepository, batchCreator, afterCommit } = this.#dependencies;
    const { userId } = todoImport;
    const linkedSourceKeys = await linkRepository.listLinkedSourceKeys(
      userId,
      items.map((item) => item.sourceKey),
    );
    const [duplicates, fresh] = partition(items, (item) => linkedSourceKeys.has(item.sourceKey));
    const [placed, unplaced] = partition(
      fresh.map((item) => ({ item, categoryId: todoImport.findCategoryIdOf(item.collectionKey) })),
      isPlaced,
    );
    const staged =
      placed.length === 0
        ? null
        : await batchCreator.stageMany({
            userId,
            timezone: todoImport.timezone,
            drafts: placed.map((placement) => toDraft(todoImport, placement)),
          });
    if (staged != null) {
      afterCommit.register(staged.afterCommit, staged.afterCommitKey);
    }
    const created = (staged?.outcomes ?? []).filter(isCreated);
    const outcomes = new Map<string, TodoImportItemOutcome>([
      ...duplicates.map((item) => [item.sourceKey, "SKIPPED_DUPLICATE"] as const),
      ...unplaced.map(({ item }) => [item.sourceKey, "SKIPPED_CATEGORY_MISSING"] as const),
      ...(staged?.outcomes ?? []).map((outcome) => [outcome.key, toItemOutcome(outcome)] as const),
    ]);
    await linkRepository.insertMany(
      created.map((outcome) => ({
        todoId: outcome.todoId,
        userId,
        sourceKey: outcome.key,
        importId: todoImport.id,
        createdAt: now,
      })),
    );
    await itemRepository.markOutcomes(todoImport.id, outcomes);
    const createdKeys = new Set(created.map((outcome) => outcome.key));
    todoImport.recordBatch({
      counts: toBatchCounts([...outcomes.values()]),
      firstDate: items
        .filter((item) => createdKeys.has(item.sourceKey))
        .map((item) => item.startDate)
        .reduce<Temporal.PlainDate | null>(earlierDate, null),
      now,
    });
  }

  #logEnd(todoImport: TodoImport, result: MaterializeTodoImportResult): void {
    if (result.kind === "completed") {
      this.#dependencies.logger.log({
        event: TodoImportLogEvent.COMPLETED,
        importId: todoImport.id.value,
        userId: todoImport.userId.value,
      });
    }
  }
}

function isMaterializingRound(
  todoImport: TodoImport | null,
  round: number,
): todoImport is TodoImport {
  return todoImport != null && todoImport.isMaterializing() && todoImport.round === round;
}

function isRoundBudgetSpent(progress: RoundProgress, now: Temporal.Instant): boolean {
  const elapsedMs = now.epochMilliseconds - progress.startedAt.epochMilliseconds;
  return (
    progress.processedCount >= TODO_IMPORT_MATERIALIZATION.ROUND_MAX_ITEMS ||
    elapsedMs >= TODO_IMPORT_MATERIALIZATION.ROUND_MAX_DURATION_MS
  );
}

interface ItemPlacement {
  readonly item: TodoImportItem;
  readonly categoryId: number | null;
}

function isPlaced(
  placement: ItemPlacement,
): placement is ItemPlacement & { readonly categoryId: number } {
  return placement.categoryId != null;
}

function toDraft(
  todoImport: TodoImport,
  { item, categoryId }: ItemPlacement & { readonly categoryId: number },
): TodoBatchDraft {
  const { timeMode, visibility } = todoImport.toPrimitives();
  return {
    key: item.sourceKey,
    categoryId: TodoCategoryId.reconstitute(categoryId),
    title: item.value.title,
    startDate: item.startDate,
    endDate: item.value.endDate,
    // 날짜만 가져오면 시각을 버려 리마인드 알림이 예약되지 않는다
    scheduledLocalTime: timeMode === "TIME" ? item.value.localTime : null,
    visibility,
  };
}

function isCreated(
  outcome: TodoBatchOutcome,
): outcome is Extract<TodoBatchOutcome, { kind: "created" }> {
  return outcome.kind === "created";
}

function toItemOutcome(outcome: TodoBatchOutcome): TodoImportItemOutcome {
  return match(outcome)
    .with({ kind: "created" }, (): TodoImportItemOutcome => "CREATED")
    .with({ kind: "rejected", reason: "CAPACITY" }, (): TodoImportItemOutcome => "SKIPPED_CAPACITY")
    .with(
      { kind: "rejected", reason: "CATEGORY_MISSING" },
      (): TodoImportItemOutcome => "SKIPPED_CATEGORY_MISSING",
    )
    .with({ kind: "rejected", reason: "INVALID" }, (): TodoImportItemOutcome => "SKIPPED_INVALID")
    .exhaustive();
}

function toBatchCounts(outcomes: readonly TodoImportItemOutcome[]) {
  const counted = countBy(outcomes, (outcome) => outcome);
  return {
    createdCount: counted.CREATED ?? 0,
    skippedDuplicateCount: counted.SKIPPED_DUPLICATE ?? 0,
    skippedCapacityCount: counted.SKIPPED_CAPACITY ?? 0,
    skippedCategoryMissingCount: counted.SKIPPED_CATEGORY_MISSING ?? 0,
    skippedInvalidCount: counted.SKIPPED_INVALID ?? 0,
  };
}
