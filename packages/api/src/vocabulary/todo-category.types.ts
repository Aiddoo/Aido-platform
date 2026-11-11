export const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
export const REORDER_POSITIONS = ["before", "after"] as const;
export type ReorderPosition = (typeof REORDER_POSITIONS)[number];

/** 카테고리를 지울 때 안의 할 일 처리: 다른 카테고리로 옮기거나 카테고리와 함께 지운다. */
export const CATEGORY_TODO_HANDLINGS = ["move", "delete"] as const;
export type CategoryTodoHandling = (typeof CATEGORY_TODO_HANDLINGS)[number];

/** 삭제 결과의 처리. none은 옮기거나 지울 할 일·진행 중 반복이 없었다는 뜻이다. */
export const CATEGORY_TODO_HANDLING_RESULTS = [...CATEGORY_TODO_HANDLINGS, "none"] as const;
export type CategoryTodoHandlingResult = (typeof CATEGORY_TODO_HANDLING_RESULTS)[number];
