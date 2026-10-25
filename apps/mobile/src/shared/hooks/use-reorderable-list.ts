import { ImpactFeedbackStyle } from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import {
  type ReorderableListDragEndEvent,
  type ReorderableListReorderEvent,
  reorderItems,
} from 'react-native-reorderable-list';
import { scheduleOnRN } from 'react-native-worklets';

import { impactFeedback, selectionFeedback } from '../utils/haptics';
import { getReorderInstruction, type ReorderInstruction } from '../utils/reorder-instruction';

export interface ReorderedList<TItem, TId> {
  instruction: ReorderInstruction<TId>;
  items: TItem[];
}

interface UseReorderableListParams<TItem, TId> {
  items: TItem[];
  updatedAt: number;
  isPending: boolean;
  getItemId: (item: TItem) => TId;
  onReorder: (reordered: ReorderedList<TItem, TId>) => void;
}

/**
 * 서버 순서를 받아 `ReorderableList`/`NestedReorderableList`에 그대로 펼칠 props를 만든다.
 * 놓으면 화면 순서를 먼저 바꾸고 서버에 이동 지시를 보낸다. 끄는 동안 들어온 서버 순서는 놓은 뒤 반영한다.
 */
export function useReorderableList<TItem, TId>({
  items,
  updatedAt,
  isPending,
  getItemId,
  onReorder,
}: UseReorderableListParams<TItem, TId>) {
  const [data, setData] = useState(items);
  const isDraggingRef = useRef(false);
  const syncedAtRef = useRef(updatedAt);

  const syncServerItems = () => {
    if (syncedAtRef.current === updatedAt) {
      return;
    }
    syncedAtRef.current = updatedAt;
    setData(items);
  };

  useEffect(() => {
    if (isDraggingRef.current || isPending) {
      return;
    }
    syncServerItems();
  }, [items, updatedAt, isPending]);

  const handleDragStart = () => {
    isDraggingRef.current = true;
    impactFeedback(ImpactFeedbackStyle.Medium);
  };

  const handleDragEnd = ({ from, to }: ReorderableListDragEndEvent) => {
    isDraggingRef.current = false;
    if (from === to) {
      syncServerItems();
    }
  };

  const handleReorder = ({ from, to }: ReorderableListReorderEvent) => {
    const reorderedItems = reorderItems(data, from, to);
    const instruction = getReorderInstruction(reorderedItems, from, to, getItemId);
    if (instruction == null) {
      return;
    }

    setData(reorderedItems);
    onReorder({ instruction, items: reorderedItems });
  };

  return {
    data,
    dragEnabled: !isPending,
    onReorder: handleReorder,
    onDragStart: () => {
      'worklet';
      scheduleOnRN(handleDragStart);
    },
    onIndexChange: () => {
      'worklet';
      scheduleOnRN(selectionFeedback);
    },
    onDragEnd: (event: ReorderableListDragEndEvent) => {
      'worklet';
      scheduleOnRN(handleDragEnd, event);
    },
  };
}
