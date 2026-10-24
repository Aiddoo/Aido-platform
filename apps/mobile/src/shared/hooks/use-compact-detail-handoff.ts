import { useIsFocused } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';

import { useWindowSizeClass } from './use-window-size-class';

export function useCompactDetailHandoff<Id>(
  selectedId: Id | undefined,
  openDetail: (id: Id) => void,
) {
  const isFocused = useIsFocused();
  const isCompact = useWindowSizeClass() === 'compact';
  const handoff = useEffectEvent(openDetail);

  useEffect(() => {
    if (!isFocused || !isCompact || selectedId == null) {
      return;
    }

    handoff(selectedId);
  }, [isFocused, isCompact, selectedId]);
}
