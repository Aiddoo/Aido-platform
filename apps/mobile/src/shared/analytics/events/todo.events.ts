export interface TodoEventMap {
  todo_created: { category_id?: number; has_due_date: boolean; source: 'manual' | 'ai' | 'voice' };
  todo_completed: { todo_id: number; is_completed: boolean };
  todo_deleted: { todo_id: number };
  todo_edited: { todo_id: number; field: string };
  category_created: undefined;
  category_deleted: undefined;
}
