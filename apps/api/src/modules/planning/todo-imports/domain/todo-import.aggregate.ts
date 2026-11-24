import type {
  TodoImportSourceKind,
  TodoImportStatus,
  TodoImportTimeMode,
  TodoVisibility,
} from "@aido/api/vocabulary";
import { sumBy } from "es-toolkit";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import {
  TodoImportCollection,
  type TodoImportCollectionPrimitives,
} from "./todo-import-collection.vo.js";
import { TodoImportId } from "./todo-import-id.vo.js";
import { earlierDate, isWithinImportRange } from "./todo-import-range.domain-service.js";
import { TodoImportRequest } from "./todo-import-request.vo.js";
import { TodoImportTarget, type TodoImportTargetPrimitives } from "./todo-import-target.vo.js";
import { judgeUndoWindow } from "./todo-import-undo.domain-service.js";
import {
  TODO_IMPORT_WORKING_STATUSES,
  type TodoImportFailureReason,
} from "./todo-imports.constants.js";
import { todoImportStatusConflict, todoImportUndoExpired } from "./todo-imports.errors.js";

export interface TodoImportCounts {
  readonly createdCount: number;
  readonly skippedDuplicateCount: number;
  readonly skippedCapacityCount: number;
  readonly skippedCategoryMissingCount: number;
  readonly skippedInvalidCount: number;
  readonly undoneCount: number;
  readonly keptCompletedCount: number;
}

export type TodoImportBatchCounts = Omit<TodoImportCounts, "undoneCount" | "keptCompletedCount">;

export interface TodoImportPrimitives extends TodoImportCounts {
  readonly id: string;
  readonly userId: string;
  readonly source: TodoImportSourceKind;
  readonly status: TodoImportStatus;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly timezone: string;
  readonly startDate: Temporal.PlainDate;
  readonly endDate: Temporal.PlainDate;
  readonly timeMode: TodoImportTimeMode;
  readonly visibility: TodoVisibility;
  readonly targets: readonly TodoImportTargetPrimitives[];
  readonly collections: readonly TodoImportCollectionPrimitives[];
  readonly expectedItemCount: number;
  readonly receivedItemCount: number;
  readonly processedItemCount: number;
  readonly firstDate: Temporal.PlainDate | null;
  readonly round: number;
  readonly recoveryCount: number;
  readonly failureReason: TodoImportFailureReason | null;
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
  readonly committedAt: Temporal.Instant | null;
  readonly completedAt: Temporal.Instant | null;
  readonly undoRequestedAt: Temporal.Instant | null;
}

type Mutable<TValue> = { -readonly [Key in keyof TValue]: TValue[Key] };

interface TodoImportProps extends Mutable<
  Omit<
    TodoImportPrimitives,
    "id" | "userId" | "idempotencyKey" | "requestHash" | "targets" | "collections"
  >
> {
  readonly userId: UserId;
  readonly request: TodoImportRequest;
  targets: readonly TodoImportTarget[];
  readonly collections: readonly TodoImportCollection[];
}

const EMPTY_COUNTS: TodoImportCounts = {
  createdCount: 0,
  skippedDuplicateCount: 0,
  skippedCapacityCount: 0,
  skippedCategoryMissingCount: 0,
  skippedInvalidCount: 0,
  undoneCount: 0,
  keptCompletedCount: 0,
};

type CreateTodoImportParams = Pick<
  TodoImportProps,
  | "userId"
  | "source"
  | "request"
  | "timezone"
  | "startDate"
  | "endDate"
  | "timeMode"
  | "visibility"
  | "targets"
  | "collections"
> & { readonly id: TodoImportId; readonly now: Temporal.Instant };

export class TodoImport extends AggregateRoot<TodoImportId, TodoImportProps> {
  static create(params: CreateTodoImportParams): TodoImport {
    const { id, now, ...fields } = params;
    return new TodoImport(id, {
      ...EMPTY_COUNTS,
      ...fields,
      status: "UPLOADING",
      expectedItemCount: sumBy(fields.collections, (collection) => collection.expectedItemCount),
      receivedItemCount: 0,
      processedItemCount: 0,
      firstDate: null,
      round: 0,
      recoveryCount: 0,
      failureReason: null,
      createdAt: now,
      updatedAt: now,
      committedAt: null,
      completedAt: null,
      undoRequestedAt: null,
    });
  }

  static reconstitute(primitives: TodoImportPrimitives): TodoImport {
    const { id, userId, idempotencyKey, requestHash, targets, collections, ...rest } = primitives;
    return new TodoImport(TodoImportId.reconstitute(id), {
      ...rest,
      userId: UserId.reconstitute(userId),
      request: TodoImportRequest.reconstitute({ idempotencyKey, requestHash }),
      targets: targets.map((target) => TodoImportTarget.reconstitute(target)),
      collections: collections.map((collection) => TodoImportCollection.reconstitute(collection)),
    });
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get status(): TodoImportStatus {
    return this.props.status;
  }

  get timezone(): string {
    return this.props.timezone;
  }

  get targets(): readonly TodoImportTarget[] {
    return this.props.targets;
  }

  get collections(): readonly TodoImportCollection[] {
    return this.props.collections;
  }

  get receivedItemCount(): number {
    return this.props.receivedItemCount;
  }

  get round(): number {
    return this.props.round;
  }

  get recoveryCount(): number {
    return this.props.recoveryCount;
  }

  get completedAt(): Temporal.Instant | null {
    return this.props.completedAt;
  }

  isCommitted(): boolean {
    return this.props.committedAt != null;
  }

  isSameRequest(request: TodoImportRequest): boolean {
    return this.props.request.equals(request);
  }

  /** 할 일을 만들 잡이 처리할 상태인지. 확정 뒤 대기·실행 중이다 */
  isMaterializing(): boolean {
    return this.props.status === "QUEUED" || this.props.status === "RUNNING";
  }

  /** 받은 일정의 시작 날짜가 가져올 기간 안인지 */
  coversDate(date: Temporal.PlainDate): boolean {
    return isWithinImportRange({
      startDate: this.props.startDate,
      endDate: this.props.endDate,
      date,
    });
  }

  hasCollection(collectionKey: string): boolean {
    return this.props.collections.some((collection) => collection.collectionKey === collectionKey);
  }

  /** 캘린더의 일정을 넣을 카테고리. 새 카테고리는 확정 전이면 null이다 */
  findCategoryIdOf(collectionKey: string): number | null {
    const collection = this.props.collections.find(
      (candidate) => candidate.collectionKey === collectionKey,
    );
    const target = this.props.targets.find(
      (candidate) => candidate.targetKey === collection?.targetKey,
    );
    return target?.categoryId ?? null;
  }

  recordReceived(acceptedCount: number, now: Temporal.Instant): boolean {
    this.#assertStatus("UPLOADING");
    if (acceptedCount === 0) {
      return false;
    }
    this.props.receivedItemCount += acceptedCount;
    this.props.updatedAt = now;
    return true;
  }

  /** 새 카테고리 id를 받아 대기열에 올린다. 이미 확정했으면 false다 */
  commit(params: {
    readonly createdCategoryIds: ReadonlyMap<string, number>;
    readonly now: Temporal.Instant;
  }): boolean {
    if (this.props.committedAt != null) {
      return false;
    }
    this.#assertStatus("UPLOADING");
    this.props.targets = this.props.targets.map((target) => {
      const categoryId = params.createdCategoryIds.get(target.targetKey);
      return categoryId == null ? target : target.withCreatedCategory(categoryId);
    });
    this.props.status = "QUEUED";
    this.props.committedAt = params.now;
    this.props.updatedAt = params.now;
    return true;
  }

  start(now: Temporal.Instant): boolean {
    if (this.props.status === "RUNNING") {
      return false;
    }
    this.#assertStatus("QUEUED");
    this.props.status = "RUNNING";
    this.props.updatedAt = now;
    return true;
  }

  recordBatch(params: {
    readonly counts: TodoImportBatchCounts;
    readonly firstDate: Temporal.PlainDate | null;
    readonly now: Temporal.Instant;
  }): boolean {
    this.#assertStatus("RUNNING");
    const { counts, firstDate } = params;
    const processed =
      counts.createdCount +
      counts.skippedDuplicateCount +
      counts.skippedCapacityCount +
      counts.skippedCategoryMissingCount +
      counts.skippedInvalidCount;
    if (processed === 0) {
      return false;
    }
    this.props.createdCount += counts.createdCount;
    this.props.skippedDuplicateCount += counts.skippedDuplicateCount;
    this.props.skippedCapacityCount += counts.skippedCapacityCount;
    this.props.skippedCategoryMissingCount += counts.skippedCategoryMissingCount;
    this.props.skippedInvalidCount += counts.skippedInvalidCount;
    this.props.processedItemCount += processed;
    this.props.firstDate = earlierDate(this.props.firstDate, firstDate);
    this.props.updatedAt = params.now;
    return true;
  }

  /** 다음 round 작업으로 넘긴다. 이 round의 작업이 다시 와도 round가 달라 처리하지 않는다 */
  continueInNextRound(now: Temporal.Instant): boolean {
    this.#assertWorking();
    this.props.round += 1;
    this.props.updatedAt = now;
    return true;
  }

  complete(now: Temporal.Instant): boolean {
    if (this.props.status === "COMPLETED") {
      return false;
    }
    this.#assertStatus("RUNNING");
    this.props.status = "COMPLETED";
    this.props.completedAt = now;
    this.props.updatedAt = now;
    return true;
  }

  /** 만든 할 일·센 수는 그대로 두고 멈춘다 */
  fail(reason: TodoImportFailureReason, now: Temporal.Instant): boolean {
    if (this.props.status === "FAILED") {
      return false;
    }
    this.#assertWorking();
    this.props.status = "FAILED";
    this.props.failureReason = reason;
    this.props.updatedAt = now;
    return true;
  }

  cancel(now: Temporal.Instant): boolean {
    return this.#stopUpload("CANCELED", now);
  }

  abandon(now: Temporal.Instant): boolean {
    return this.#stopUpload("ABANDONED", now);
  }

  requestUndo(now: Temporal.Instant): boolean {
    if (this.props.status === "UNDOING" || this.props.status === "UNDONE") {
      return false;
    }
    this.#assertStatus("COMPLETED");
    const { completedAt } = this.props;
    const window = completedAt == null ? null : judgeUndoWindow({ completedAt, now });
    if (window?.kind !== "open") {
      throw todoImportUndoExpired(window?.undoableUntil ?? null);
    }
    this.props.status = "UNDOING";
    this.props.undoRequestedAt = now;
    this.props.updatedAt = now;
    return true;
  }

  recordUndone(undoneCount: number, now: Temporal.Instant): boolean {
    this.#assertStatus("UNDOING");
    this.props.undoneCount += undoneCount;
    this.props.updatedAt = now;
    return true;
  }

  /** 남은 링크 수가 완료해서 남긴 할 일 수다 */
  finishUndo(keptCompletedCount: number, now: Temporal.Instant): boolean {
    if (this.props.status === "UNDONE") {
      return false;
    }
    this.#assertStatus("UNDOING");
    this.props.status = "UNDONE";
    this.props.keptCompletedCount = keptCompletedCount;
    this.props.updatedAt = now;
    return true;
  }

  /** 진행이 멈춘 작업을 다시 넣는다. round를 올려 남아 있던 옛 작업이 처리하지 않게 한다 */
  recordRecovery(now: Temporal.Instant): boolean {
    this.#assertWorking();
    this.props.recoveryCount += 1;
    this.props.round += 1;
    this.props.updatedAt = now;
    return true;
  }

  toPrimitives(): TodoImportPrimitives {
    const { userId, request, targets, collections, ...rest } = this.props;
    return {
      ...rest,
      id: this.id.value,
      userId: userId.value,
      idempotencyKey: request.idempotencyKey,
      requestHash: request.requestHash,
      targets: targets.map((target) => target.value),
      collections: collections.map((collection) => collection.value),
    };
  }

  #stopUpload(status: "CANCELED" | "ABANDONED", now: Temporal.Instant): boolean {
    if (this.props.status === status) {
      return false;
    }
    this.#assertStatus("UPLOADING");
    this.props.status = status;
    this.props.updatedAt = now;
    return true;
  }

  #assertStatus(expected: TodoImportStatus): void {
    if (this.props.status !== expected) {
      throw todoImportStatusConflict(this.props.status);
    }
  }

  #assertWorking(): void {
    if (!TODO_IMPORT_WORKING_STATUSES.some((status) => status === this.props.status)) {
      throw todoImportStatusConflict(this.props.status);
    }
  }
}
