import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';

import {
  type CalendarViewMode,
  calendarViewModeSchema,
} from '../schemas/calendar-view-mode.schema';

const CALENDAR_VIEW_MODE_KEY = 'aido_calendar_view_mode';
const DEFAULT_VIEW_MODE: CalendarViewMode = 'week';

export interface CalendarViewModeRepository {
  /** 저장하지 않았거나 모르는 값이면 주 보기다 */
  get(): CalendarViewMode;
  save(viewMode: CalendarViewMode): void;
  subscribe(listener: () => void): () => void;
}

/** 달력의 주·월 보기. 계정과 무관한 기기 설정이다 */
export function createCalendarViewModeRepository(
  storage: ObservableSyncStorage,
): CalendarViewModeRepository {
  return {
    get: () =>
      calendarViewModeSchema.catch(DEFAULT_VIEW_MODE).parse(storage.get(CALENDAR_VIEW_MODE_KEY)),
    save: (viewMode) => storage.set(CALENDAR_VIEW_MODE_KEY, viewMode),
    subscribe: (listener) => storage.subscribe(CALENDAR_VIEW_MODE_KEY, listener),
  };
}
