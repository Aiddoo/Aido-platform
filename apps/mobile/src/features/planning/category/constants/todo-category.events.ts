import type {
  CategoryDeletedTodoHandling,
  TodoCountBucket,
} from '../utils/todo-category-analytics';

/** 카테고리 이름·id는 싣지 않는다. 할 일 수는 구간으로만 남긴다 */
declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    // oxlint-disable-next-line aido/analytics-event-catalog -- 1.15.2 전환 #1400
    category_created: { color: string };
    category_updated: { field: 'name' | 'color' };
    category_delete_sheet_viewed: { todo_count_bucket: TodoCountBucket; has_series: boolean };
    category_delete_cancelled: { todo_count_bucket: TodoCountBucket };
    category_deleted: {
      todo_handling: CategoryDeletedTodoHandling;
      todo_count_bucket: TodoCountBucket;
    };
    category_reordered: { source: 'settings' };
  }
}
