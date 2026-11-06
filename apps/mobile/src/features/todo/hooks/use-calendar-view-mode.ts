import { mmkvSyncStorage } from '@src/shared/infra/storage/mmkv-storage';
import {
  type CalendarViewMode,
  readCalendarViewMode,
  subscribeCalendarViewMode,
  writeCalendarViewMode,
} from '@src/shared/preferences/calendar-view-mode.preference';
import { useSyncExternalStore } from 'react';

function subscribe(listener: () => void) {
  return subscribeCalendarViewMode(mmkvSyncStorage, listener);
}

function getViewMode() {
  return readCalendarViewMode(mmkvSyncStorage);
}

function setViewMode(mode: CalendarViewMode) {
  writeCalendarViewMode(mmkvSyncStorage, mode);
}

/** 기기에 저장된 달력 보기. 값이 바뀌면 쓰는 곳이 모두 함께 갱신된다 */
export function useCalendarViewMode() {
  const viewMode = useSyncExternalStore(subscribe, getViewMode);

  return [viewMode, setViewMode] as const;
}
