export interface TodoEventMap {
  todo_created: {
    source: 'manual' | 'ai';
    is_recurring: boolean;
    has_scheduled_time: boolean;
    is_all_day: boolean;
    visibility: 'PUBLIC' | 'PRIVATE';
  };
  todo_completed: { todo_id: number; is_completed: boolean };
  todo_deleted: { todo_id: number };
  todo_edited: { todo_id: number; field: string };
  category_created: { color: string };
  category_updated: { field: 'name' | 'color' };
  category_deleted: undefined;
}
