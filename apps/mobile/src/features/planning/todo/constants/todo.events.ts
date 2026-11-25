import type {
  TODO_REPEAT_END_TYPES,
  TodoEditScope,
  TodoRepeatFrequency,
  TodoVisibility,
} from '@aido/api/vocabulary';
import type { AnalyticsSource } from '@src/shared/analytics/event-vocabulary';

import type { TodoEditedFields } from '../utils/todo-analytics';

type TodoCreationEntry = 'manual' | 'recurring';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    todo_created: {
      source: AnalyticsSource<'manual'>;
      creation_entry: TodoCreationEntry;
      is_recurring: boolean;
      has_scheduled_time: boolean;
      is_all_day: boolean;
      visibility: TodoVisibility;
      repeat_frequency?: TodoRepeatFrequency;
      repeat_end?: (typeof TODO_REPEAT_END_TYPES)[number];
    };
    todo_completed: { todo_id: number; is_completed: boolean };
    todo_deleted: { todo_id: number };
    todo_edited: { todo_id: number; field?: TodoEditedFields };
    todo_series_edited: { scope: TodoEditScope };
    todo_series_deleted: { scope: TodoEditScope };
    todo_series_stopped: undefined;
    todo_item_added: { todo_id: number };
    todo_item_completed: { todo_id: number; item_id: number; is_completed: boolean };
    todo_item_updated: { todo_id: number; item_id: number };
    todo_item_deleted: { todo_id: number; item_id: number };
    todo_item_reordered: { todo_id: number };
    todo_reordered: { source: AnalyticsSource<'feed'> };
  }
}
