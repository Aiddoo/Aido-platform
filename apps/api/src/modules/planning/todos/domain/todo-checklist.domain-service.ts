import { TODO_ITEM_LIMITS } from "@aido/api/vocabulary";

import { checklistLimitReached } from "../../shared/domain/planning.errors.js";
import type { TodoTitle } from "../../shared/domain/todo-title.vo.js";
import type { TodoItemId } from "./todo-item-id.vo.js";
import { TodoItem } from "./todo-item.entity.js";
import {
  checklistItemNotFound,
  duplicateChecklistItemIds,
  incompleteChecklistItemIds,
} from "./todos.errors.js";

/** 끝에 붙인 새 항목. 한도를 넘으면 TODO_0838이다. */
export function appendChecklistItem(
  items: readonly TodoItem[],
  item: { readonly id: TodoItemId; readonly title: TodoTitle; readonly now: Temporal.Instant },
): TodoItem {
  if (items.length >= TODO_ITEM_LIMITS.MAX_PER_TODO) {
    throw checklistLimitReached(items.length);
  }
  const maxSortOrder = items.reduce((max, entry) => Math.max(max, entry.sortOrder), -1);
  return TodoItem.create({ ...item, sortOrder: maxSortOrder + 1 });
}

export function findChecklistItem(items: readonly TodoItem[], itemId: TodoItemId): TodoItem {
  const item = items.find((entry) => entry.id.equals(itemId));
  if (item == null) {
    throw checklistItemNotFound(itemId.value);
  }
  return item;
}

/** 모든 하위 항목 id를 한 번씩 받아야 한다. 배열 순서가 새 순서다. */
export function orderChecklistItems(
  items: readonly TodoItem[],
  itemIds: readonly TodoItemId[],
): TodoItem[] {
  const uniqueItemIds = new Set(itemIds.map((itemId) => itemId.value));
  if (uniqueItemIds.size !== itemIds.length) {
    throw duplicateChecklistItemIds(itemIds.length, uniqueItemIds.size);
  }
  if (itemIds.length !== items.length) {
    throw incompleteChecklistItemIds(items.length, itemIds.length);
  }
  return itemIds.map((itemId) => findChecklistItem(items, itemId));
}
