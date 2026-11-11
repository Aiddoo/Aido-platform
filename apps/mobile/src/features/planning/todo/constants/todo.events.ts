import type { UpdateTodoInput } from '../schemas/todo-request.schema';

type TodoCreationEntry = 'manual' | 'recurring';
type SeriesScope = 'THIS_ONLY' | 'THIS_AND_FOLLOWING' | 'ALL';
type TodoEditedField = keyof UpdateTodoInput;
/** 고친 칸 이름을 고친 순서대로 쉼표로 이은 값(`title,startDate`). 다중 칸 버킷은 대시보드를 확인한 뒤 정한다 */
export type TodoEditedFields = TodoEditedField | `${TodoEditedField},${string}`;

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    todo_created: {
      source: 'manual';
      creation_entry: TodoCreationEntry;
      is_recurring: boolean;
      has_scheduled_time: boolean;
      is_all_day: boolean;
      visibility: 'PUBLIC' | 'PRIVATE';
      repeat_frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
      repeat_end?: 'NEVER' | 'UNTIL' | 'COUNT';
    };
    todo_completed: { todo_id: number; is_completed: boolean };
    todo_deleted: { todo_id: number };
    todo_edited: { todo_id: number; field?: TodoEditedFields };
    todo_series_edited: { scope: SeriesScope };
    todo_series_deleted: { scope: SeriesScope };
    todo_series_stopped: undefined;
    todo_item_added: { todo_id: number };
    todo_item_completed: { todo_id: number; item_id: number; is_completed: boolean };
    todo_item_updated: { todo_id: number; item_id: number };
    todo_item_deleted: { todo_id: number; item_id: number };
    todo_item_reordered: { todo_id: number };
    todo_reordered: { source: 'feed' };
  }
}
