import { TODO_LIMITS, type TodoVisibility } from "@aido/api/vocabulary";
import { orderBy, partition, uniqBy, zip } from "es-toolkit";

import type { TodoCategoryId } from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import type { Timezone } from "#api/shared/domain/time/timezone.vo";

import { toTodoTimezone } from "../../../shared/domain/todo-calendar.domain-service.js";
import { appendSortOrders } from "../../../shared/domain/todo-sort-order.domain-service.js";
import { TodoTitle } from "../../../shared/domain/todo-title.vo.js";
import {
  admitTodoBatch,
  type TodoBatchAdmission,
} from "../../domain/todo-batch-admission.domain-service.js";
import { TodoSchedule } from "../../domain/todo-schedule.vo.js";
import { Todo } from "../../domain/todo.aggregate.js";
import type { CategoryOwnershipPort } from "../ports/category-ownership.port.js";
import type {
  StagedTodoBatch,
  StageTodoBatchInput,
  TodoBatchDraft,
  TodoBatchOutcome,
} from "../ports/staged-todo-batch-creator.port.js";
import type { TodoOccurrenceWriterPort } from "../ports/todo-occurrence-writer.port.js";
import type { TodoRepositoryPort } from "../ports/todo.repository.port.js";
import type { ApplyTodoEventsUseCase } from "./apply-todo-events.use-case.js";
import type { PublishTodoBatchCreatedUseCase } from "./publish-todo-batch-created.use-case.js";

interface BuiltTodoDraft {
  readonly index: number;
  readonly key: string;
  readonly categoryId: TodoCategoryId;
  readonly title: TodoTitle;
  readonly schedule: TodoSchedule;
  readonly visibility: TodoVisibility;
}

interface OrderedOutcome {
  readonly index: number;
  readonly outcome: TodoBatchOutcome;
}

type DraftBuild =
  | { readonly kind: "built"; readonly draft: BuiltTodoDraft }
  | { readonly kind: "invalid"; readonly outcome: OrderedOutcome };

interface StageTodoBatchCreationDependencies {
  readonly todoRepository: Pick<
    TodoRepositoryPort,
    "countCategoryUsages" | "getMaxSortOrder" | "insertMany"
  >;
  readonly occurrenceWriter: Pick<TodoOccurrenceWriterPort, "nextIds">;
  readonly categoryOwnership: Pick<CategoryOwnershipPort, "listOwnedCategoryIds">;
  readonly applyTodoEvents: Pick<ApplyTodoEventsUseCase, "execute">;
  readonly publishBatchCreated: Pick<PublishTodoBatchCreatedUseCase, "execute">;
  readonly clock: ClockPort;
}

export class StageTodoBatchCreationUseCase {
  readonly #dependencies: StageTodoBatchCreationDependencies;

  constructor(dependencies: StageTodoBatchCreationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: StageTodoBatchInput): Promise<StagedTodoBatch> {
    const { userId } = input;
    const timezone = toTodoTimezone(input.timezone);
    const [built, invalid] = partition(
      input.drafts.map((draft, index) => buildDraft(draft, index, timezone)),
      isBuilt,
    );
    const [admitted, rejected] = partition(
      await this.#admit(
        userId,
        built.map((build) => build.draft),
      ),
      isAdmitted,
    );
    const created = await this.#insert(
      userId,
      admitted.map((admission) => admission.entry),
    );
    const outcomes = [
      ...invalid.map((build) => build.outcome),
      ...rejected.map((admission) => rejectedOutcome(admission.entry, admission.reason)),
      ...created,
    ];
    return {
      outcomes: orderBy(outcomes, ["index"], ["asc"]).map(({ outcome }) => outcome),
      afterCommit: () =>
        this.#dependencies.publishBatchCreated.execute({ userId, count: created.length }),
      afterCommitKey: `todo-batch:${userId.value}`,
    };
  }

  async #admit(userId: UserId, drafts: readonly BuiltTodoDraft[]) {
    const categoryIds = uniqBy(
      drafts.map((draft) => draft.categoryId),
      (categoryId) => categoryId.value,
    );
    const { categoryOwnership, todoRepository } = this.#dependencies;
    const ownedCategoryIds = await categoryOwnership.listOwnedCategoryIds(userId, categoryIds);
    const usageByCategory = await todoRepository.countCategoryUsages(
      userId,
      categoryIds.filter((categoryId) => ownedCategoryIds.has(categoryId.value)),
    );
    return admitTodoBatch({
      entries: drafts,
      ownedCategoryIds,
      usageByCategory,
      limitPerCategory: TODO_LIMITS.MAX_PER_CATEGORY,
    });
  }

  async #insert(userId: UserId, drafts: readonly BuiltTodoDraft[]): Promise<OrderedOutcome[]> {
    if (drafts.length === 0) {
      return [];
    }
    const { todoRepository, occurrenceWriter, applyTodoEvents, clock } = this.#dependencies;
    const sortOrders = appendSortOrders(
      await todoRepository.getMaxSortOrder(userId),
      drafts.length,
    );
    const ids = await occurrenceWriter.nextIds(drafts.length);
    const now = clock.now();
    const todos = zip(drafts, zip(ids, sortOrders)).map(([draft, [id, sortOrder]]) =>
      Todo.create({
        id,
        userId,
        categoryId: draft.categoryId,
        title: draft.title,
        schedule: draft.schedule,
        visibility: draft.visibility,
        sortOrder,
        now,
      }),
    );
    await todoRepository.insertMany(todos);
    await applyTodoEvents.execute(todos.flatMap((todo) => todo.pullDomainEvents()));
    return zip(drafts, todos).map(([draft, todo]) => ({
      index: draft.index,
      outcome: { kind: "created", key: draft.key, todoId: todo.id },
    }));
  }
}

function isBuilt(build: DraftBuild): build is Extract<DraftBuild, { kind: "built" }> {
  return build.kind === "built";
}

function isAdmitted(
  admission: TodoBatchAdmission<BuiltTodoDraft>,
): admission is Extract<TodoBatchAdmission<BuiltTodoDraft>, { kind: "admitted" }> {
  return admission.kind === "admitted";
}

function buildDraft(draft: TodoBatchDraft, index: number, timezone: Timezone): DraftBuild {
  try {
    return {
      kind: "built",
      draft: {
        index,
        key: draft.key,
        categoryId: draft.categoryId,
        title: TodoTitle.create(draft.title),
        schedule: TodoSchedule.create({
          startDate: draft.startDate,
          endDate: draft.endDate,
          scheduledLocalTime: draft.scheduledLocalTime,
          isAllDay: draft.scheduledLocalTime == null,
          timezone,
        }),
        visibility: draft.visibility,
      },
    };
  } catch (error) {
    // 제목·날짜 순서는 DomainException, 벽시계 모양은 Temporal RangeError다. 초안 하나로 묶음을 멈추지 않는다
    if (error instanceof DomainException || error instanceof RangeError) {
      return { kind: "invalid", outcome: rejectedOutcome({ index, key: draft.key }, "INVALID") };
    }
    throw error;
  }
}

function rejectedOutcome(
  draft: Pick<BuiltTodoDraft, "index" | "key">,
  reason: Extract<TodoBatchOutcome, { kind: "rejected" }>["reason"],
): OrderedOutcome {
  return { index: draft.index, outcome: { kind: "rejected", key: draft.key, reason } };
}
