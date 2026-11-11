import { usePaneSizeClass } from '@src/shared/ui';
import { useIsFocused } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';

/** 좁은 화면에서는 목록과 상세가 따로라, 목록에서 고른 항목이 있으면 포커스를 받을 때 상세 화면을 연다. */
export function useOpenDetailWhenCompact<Id>(
  selectedId: Id | undefined,
  openDetail: (id: Id) => void,
) {
  const isFocused = useIsFocused();
  const isCompact = usePaneSizeClass() === 'compact';
  const handoff = useEffectEvent(openDetail);

  useEffect(() => {
    if (!isFocused || !isCompact || selectedId == null) {
      return;
    }

    handoff(selectedId);
  }, [isFocused, isCompact, selectedId]);
}
