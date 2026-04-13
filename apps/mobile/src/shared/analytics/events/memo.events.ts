export interface MemoEventMap {
  memo_created: undefined;
  memo_updated: { memo_id: number };
  memo_deleted: { memo_id: number };
  memo_pin_toggled: { memo_id: number; is_pinned: boolean };
  memo_converted_to_todo: { memo_id: number };
  memo_converted_to_todos: { memo_id: number; todo_count: number; source: string };
}
