import { useCalendarViewModeRepository } from '@src/bootstrap/providers/di-context';
import { useSyncExternalStore } from 'react';

export function useCalendarViewMode() {
  const repository = useCalendarViewModeRepository();
  const viewMode = useSyncExternalStore(repository.subscribe, repository.get);

  return [viewMode, repository.save] as const;
}
