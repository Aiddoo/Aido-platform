import type { ActionPlanSource } from "@aido/api/vocabulary";

import { fingerprintRequest } from "#api/modules/ai-assistance/generation/ai-assistance-generation.public";
import {
  MemoId,
  MemoLockKeys,
  type PlanMemo,
  type PlanMemoWriterPort,
} from "#api/modules/notes/memos/notes-memos.public";
import {
  TodoCategoryId,
  TodoCategoryLockKeys,
} from "#api/modules/planning/categories/planning-categories.public";
import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import {
  type StagedTodoCreatorPort,
  TodoLockKeys,
  type TodoPlanReaderPort,
  type TodoReadModel,
} from "#api/modules/planning/todos/planning-todos.public";
import type { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { ActionPlan, type PlannedAction } from "../../domain/action-plan.vo.js";
import { PlanApplication } from "../../domain/plan-application.aggregate.js";
import { planRequestMismatch, sourceMemoNotFound } from "../action-plans.errors.js";
import { ActionPlanLogEvent } from "../action-plans.log-events.js";
import type { PlanApplicationRepositoryPort } from "../ports/plan-application.repository.port.js";
import type { PlanningContextReaderPort } from "../ports/planning-context.reader.port.js";

export interface ApplyActionPlanCommand {
  readonly userId: string;
  readonly timezone: string | undefined;
  readonly source: ActionPlanSource;
  /** source가 MEMO일 때의 원본 메모. 저장에 성공하면 지운다 */
  readonly sourceMemoId: number | undefined;
  readonly actions: readonly PlannedAction[];
  readonly idempotencyKey: string;
}

/** 저장했거나 앞서 저장한 계획의 결과. 그 뒤 사용자가 지운 할 일·메모는 빠진다 */
export interface AppliedActionPlan {
  readonly todos: readonly TodoReadModel[];
  readonly memo: PlanMemo | null;
}

interface ApplyActionPlanDependencies {
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly mutationLock: Pick<MutationLockPort, "acquire">;
  readonly afterCommit: Pick<AfterCommitTaskRegistryPort, "register">;
  readonly repository: Pick<PlanApplicationRepositoryPort, "findByIdempotencyKey" | "save">;
  readonly contextReader: Pick<PlanningContextReaderPort, "findOwnedCategoryIds">;
  readonly todoCreator: Pick<StagedTodoCreatorPort, "stage">;
  readonly todoReader: Pick<TodoPlanReaderPort, "findManyByIds">;
  readonly memoWriter: Pick<PlanMemoWriterPort, "create" | "findById" | "delete">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

type ApplyOutcome =
  | { readonly kind: "applied"; readonly applied: AppliedActionPlan }
  | { readonly kind: "replayed"; readonly application: PlanApplication };

/**
 * 사용자가 확인한 행동을 저장한다. 사용 횟수를 차감하지 않고 AI도 부르지 않는다. 한 UoW 안에서 사용자 잠금 →
 * 멱등 확인 → 카테고리 소유 확인 → 생성 순서로 실행해, 하나라도 실패하면 아무것도 남지 않고 앱은 고친 카드를
 * 그대로 다시 보낼 수 있다.
 */
export class ApplyActionPlanUseCase {
  readonly #dependencies: ApplyActionPlanDependencies;

  constructor(dependencies: ApplyActionPlanDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: ApplyActionPlanCommand): Promise<AppliedActionPlan> {
    const { userId, source, sourceMemoId } = command;
    const owner = UserId.reconstitute(userId);
    const plan = ActionPlan.create(command.actions);
    const requestHash = fingerprintRequest(userId, {
      source,
      sourceMemoId,
      actions: command.actions,
    });
    const outcome = await this.#dependencies.unitOfWork.run<ApplyOutcome>(async () => {
      await this.#dependencies.mutationLock.acquire([
        ...(sourceMemoId == null ? [] : [MemoLockKeys.memo(MemoId.reconstitute(sourceMemoId))]),
        MemoLockKeys.sortOrder(owner),
        TodoCategoryLockKeys.userCategories(userId),
        TodoLockKeys.sortOrder(userId),
      ]);
      const existing = await this.#dependencies.repository.findByIdempotencyKey(
        owner,
        command.idempotencyKey,
      );
      if (existing != null) {
        if (!existing.isSameRequest(requestHash)) {
          throw planRequestMismatch();
        }
        return { kind: "replayed", application: existing };
      }
      await this.#assertSourceMemoExists(userId, sourceMemoId);
      plan.assertCategoriesOwned(
        await this.#dependencies.contextReader.findOwnedCategoryIds(owner),
      );
      return { kind: "applied", applied: await this.#apply(plan, command, requestHash) };
    });
    const logFields = { userId, source, todoCount: plan.todos.length, hasMemo: plan.memo != null };
    if (outcome.kind === "applied") {
      this.#dependencies.logger.log({
        event: ActionPlanLogEvent.PLAN_APPLY_COMPLETED,
        ...logFields,
      });
      return outcome.applied;
    }
    this.#dependencies.logger.log({ event: ActionPlanLogEvent.PLAN_APPLY_REPLAYED, ...logFields });
    return this.#readApplied(outcome.application);
  }

  async #apply(
    plan: ActionPlan,
    command: ApplyActionPlanCommand,
    requestHash: string,
  ): Promise<AppliedActionPlan> {
    const { todoCreator, memoWriter, afterCommit, repository, clock } = this.#dependencies;
    const { userId, timezone, source, sourceMemoId, idempotencyKey } = command;
    const owner = UserId.reconstitute(userId);
    const todos: TodoReadModel[] = [];
    for (const todo of plan.todos) {
      const staged = await todoCreator.stage({
        userId: owner,
        title: todo.title,
        categoryId: TodoCategoryId.reconstitute(todo.categoryId),
        startDate: Temporal.PlainDate.from(todo.startDate),
        endDate: todo.endDate == null ? null : Temporal.PlainDate.from(todo.endDate),
        scheduledTime: todo.scheduledTime,
        timezone,
        isAllDay: todo.scheduledTime == null,
        visibility: todo.visibility ?? "PUBLIC",
        items: todo.items,
        repeat: todo.repeat,
      });
      afterCommit.register(staged.afterCommit);
      // 반복은 90일 치 회차를 만들지만 응답에는 맨 앞의 첫 회차만 싣는다.
      todos.push(...staged.todos.slice(0, 1));
    }
    // 새 메모보다 먼저 지워 원본 메모가 개수 상한을 채우고 있어도 저장할 수 있게 한다.
    if (sourceMemoId != null) {
      await memoWriter.delete(MemoId.reconstitute(sourceMemoId), owner);
    }
    const { memoContent } = plan;
    const memo =
      memoContent == null ? null : await memoWriter.create({ userId: owner, content: memoContent });
    await repository.save(
      PlanApplication.create({
        userId: owner,
        idempotencyKey,
        requestHash,
        source,
        todoIds: todos.map((todo) => todo.id),
        memoId: memo?.id ?? null,
        now: clock.now(),
      }),
    );
    return { todos, memo };
  }

  /** 메모를 할 일로 바꾸는 기존 흐름과 같게, 없거나 남의 메모면 만들기 전에 MEMO_2001로 거절한다. */
  async #assertSourceMemoExists(userId: string, memoId: number | undefined): Promise<void> {
    if (memoId == null) {
      return;
    }
    const { memoWriter } = this.#dependencies;
    if (
      (await memoWriter.findById(MemoId.reconstitute(memoId), UserId.reconstitute(userId))) == null
    ) {
      throw sourceMemoNotFound(memoId);
    }
  }

  /** 그 뒤 사용자가 지운 할 일·메모는 돌려주지 않는다. 다시 만들지도 않는다. */
  async #readApplied(application: PlanApplication): Promise<AppliedActionPlan> {
    const { todoReader, memoWriter } = this.#dependencies;
    const { memoId } = application;
    const [todos, memo] = await Promise.all([
      todoReader.findManyByIds(
        application.userId,
        application.todoIds.map((todoId) => TodoId.reconstitute(todoId)),
      ),
      memoId == null ? null : memoWriter.findById(MemoId.reconstitute(memoId), application.userId),
    ]);
    return { todos, memo };
  }
}
