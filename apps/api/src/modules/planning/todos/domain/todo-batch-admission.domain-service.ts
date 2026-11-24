import type { TodoCategoryId } from "../../todo-categories/domain/todo-category-id.vo.js";
import type { TODO_BATCH_REJECTION_REASONS } from "./todos.constants.js";

export type TodoBatchRejectionReason = (typeof TODO_BATCH_REJECTION_REASONS)[number];

export type TodoBatchAdmission<TEntry> =
  | { readonly kind: "admitted"; readonly entry: TEntry }
  | {
      readonly kind: "rejected";
      readonly entry: TEntry;
      readonly reason: Exclude<TodoBatchRejectionReason, "INVALID">;
    };

export interface TodoBatchAdmissionInput<TEntry extends { readonly categoryId: TodoCategoryId }> {
  // 앞선 초안부터 자리를 준다. 호출자가 가까운 날짜부터 넘기면 먼 일정이 먼저 빠진다
  readonly entries: readonly TEntry[];
  readonly ownedCategoryIds: ReadonlySet<number>;
  readonly usageByCategory: ReadonlyMap<number, number>;
  readonly limitPerCategory: number;
}

export function admitTodoBatch<TEntry extends { readonly categoryId: TodoCategoryId }>(
  input: TodoBatchAdmissionInput<TEntry>,
): TodoBatchAdmission<TEntry>[] {
  const admittedByCategory = new Map<number, number>();
  return input.entries.map((entry): TodoBatchAdmission<TEntry> => {
    const categoryId = entry.categoryId.value;
    if (!input.ownedCategoryIds.has(categoryId)) {
      return { kind: "rejected", entry, reason: "CATEGORY_MISSING" };
    }
    const admitted = admittedByCategory.get(categoryId) ?? 0;
    const usage = input.usageByCategory.get(categoryId) ?? 0;
    if (usage + admitted >= input.limitPerCategory) {
      return { kind: "rejected", entry, reason: "CAPACITY" };
    }
    admittedByCategory.set(categoryId, admitted + 1);
    return { kind: "admitted", entry };
  });
}
