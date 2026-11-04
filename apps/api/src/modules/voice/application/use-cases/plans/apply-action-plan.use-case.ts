import type { ApplyActionPlanResponse, Memo, Todo } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import type { ActionPlanSource } from "@aido/api/vocabulary";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  type AfterCommitTaskRegistryPort,
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { parseDateOnly } from "#api/shared/domain/date/utils/parse";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import {
  ActionPlan,
  type PlannedAction,
} from "../../../domain/value-objects/plans/action-plan.vo.js";
import { VoiceLogEvent } from "../../observability/plans/voice-log.events.js";
import type {
  PlanApplicationRecord,
  PlanApplicationRepositoryPort,
} from "../../ports/plans/plan-application.repository.port.js";
import type { PlanMemoWriterPort } from "../../ports/plans/plan-memo-writer.port.js";
import type { PlanTodoCreatorPort } from "../../ports/plans/plan-todo-creator.port.js";
import type { PlanTodoReaderPort } from "../../ports/plans/plan-todo-reader.port.js";
import type { PlanningContextReaderPort } from "../../ports/plans/planning-context.reader.port.js";
import { fingerprintRequest } from "../../services/plans/request-fingerprint.js";

export interface ApplyActionPlanInput {
  readonly userId: string;
  readonly timezone: string;
  readonly source: ActionPlanSource;
  /** source가 MEMO일 때의 원본 메모. 저장에 성공하면 지운다 */
  readonly sourceMemoId: number | undefined;
  readonly actions: readonly PlannedAction[];
  readonly idempotencyKey: string;
}

interface ApplyActionPlanDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly afterCommit: AfterCommitTaskRegistryPort;
  readonly repository: Pick<PlanApplicationRepositoryPort, "findByKey" | "insert">;
  readonly contextReader: Pick<PlanningContextReaderPort, "findOwnedCategoryIds">;
  readonly todoCreator: PlanTodoCreatorPort;
  readonly memoWriter: PlanMemoWriterPort;
  readonly todoReader: PlanTodoReaderPort;
  readonly logger: Pick<ApplicationLogger, "log">;
}

type ApplyOutcome =
  | { readonly kind: "applied"; readonly todos: readonly Todo[]; readonly memo: Memo | null }
  | { readonly kind: "replayed"; readonly record: PlanApplicationRecord };

/**
 * 사용자가 확인한 행동을 저장한다. 사용 횟수를 차감하지 않고 AI도 부르지 않는다. 한 UoW 안에서 사용자 잠금 →
 * 멱등 확인 → 카테고리 소유 확인 → 생성 순서로 실행해, 하나라도 실패하면 아무것도 남지 않고 앱은 고친 카드를
 * 그대로 다시 보낼 수 있다.
 */
export class ApplyActionPlan {
  readonly #dependencies: ApplyActionPlanDependencies;

  constructor(dependencies: ApplyActionPlanDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ApplyActionPlanInput): Promise<ApplyActionPlanResponse> {
    const { userId, source, sourceMemoId } = input;
    const plan = ActionPlan.create(input.actions);
    const requestHash = fingerprintRequest(userId, {
      source,
      sourceMemoId,
      actions: input.actions,
    });
    const outcome = await this.#dependencies.unitOfWork.run<ApplyOutcome>(async () => {
      await this.#dependencies.mutationLock.acquire([
        ...(sourceMemoId == null ? [] : [MutationLockKeys.memo(sourceMemoId)]),
        MutationLockKeys.memoSortOrder(userId),
        MutationLockKeys.todoCategory(userId),
        MutationLockKeys.todoSortOrder(userId),
      ]);
      const existing = await this.#dependencies.repository.findByKey(userId, input.idempotencyKey);
      if (existing != null) {
        if (existing.requestHash !== requestHash) {
          throw new ApplicationException(ErrorCode.AI_1318, { charged: false });
        }
        return { kind: "replayed", record: existing };
      }
      await this.#assertSourceMemoExists(userId, sourceMemoId);
      plan.assertCategoriesOwned(
        await this.#dependencies.contextReader.findOwnedCategoryIds(userId),
      );
      return this.#apply(plan, input, requestHash);
    });
    const logFields = { userId, source, todoCount: plan.todos.length, hasMemo: plan.memo != null };
    if (outcome.kind === "applied") {
      this.#dependencies.logger.log({ event: VoiceLogEvent.PLAN_APPLY_COMPLETED, ...logFields });
      return { todos: [...outcome.todos], memo: outcome.memo };
    }
    this.#dependencies.logger.log({ event: VoiceLogEvent.PLAN_APPLY_REPLAYED, ...logFields });
    return this.#readApplied(outcome.record);
  }

  async #apply(
    plan: ActionPlan,
    input: ApplyActionPlanInput,
    requestHash: string,
  ): Promise<ApplyOutcome> {
    const { todoCreator, memoWriter, afterCommit, repository } = this.#dependencies;
    const { userId, timezone, source, sourceMemoId, idempotencyKey } = input;
    const todos: Todo[] = [];
    for (const todo of plan.todos) {
      const staged = await todoCreator.stage({
        userId,
        title: todo.title,
        categoryId: todo.categoryId,
        startDate: parseDateOnly(todo.startDate),
        endDate: todo.endDate == null ? null : parseDateOnly(todo.endDate),
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
      await memoWriter.delete(sourceMemoId, userId);
    }
    const { memoContent } = plan;
    const memo =
      memoContent == null ? null : await memoWriter.create({ userId, content: memoContent });
    await repository.insert({
      userId,
      idempotencyKey,
      requestHash,
      source,
      todoIds: todos.map((todo) => todo.id),
      memoId: memo?.id ?? null,
    });
    return { kind: "applied", todos, memo };
  }

  /** 메모를 할 일로 바꾸는 기존 흐름과 같게, 없거나 남의 메모면 만들기 전에 MEMO_2001로 거절한다. */
  async #assertSourceMemoExists(userId: string, memoId: number | undefined): Promise<void> {
    if (memoId == null) {
      return;
    }
    if ((await this.#dependencies.memoWriter.findById(memoId, userId)) == null) {
      throw new ApplicationException(ErrorCode.MEMO_2001, { memoId });
    }
  }

  /** 그 뒤 사용자가 지운 할 일·메모는 돌려주지 않는다. 다시 만들지도 않는다. */
  async #readApplied(record: PlanApplicationRecord): Promise<ApplyActionPlanResponse> {
    const { todoReader, memoWriter } = this.#dependencies;
    const [todos, memo] = await Promise.all([
      todoReader.findManyByIds(record.userId, record.todoIds),
      record.memoId == null ? null : memoWriter.findById(record.memoId, record.userId),
    ]);
    return { todos, memo };
  }
}
