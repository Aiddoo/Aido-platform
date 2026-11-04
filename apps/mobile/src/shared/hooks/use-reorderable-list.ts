import { useHaptics } from '@src/bootstrap/providers/di-context';
import { useState } from 'react';
import {
  type ReorderableListDragEndEvent,
  type ReorderableListReorderEvent,
  reorderItems,
} from 'react-native-reorderable-list';
import { scheduleOnRN } from 'react-native-worklets';

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

interface ReorderHold<TItem> {
  items: TItem[];
  updatedAt: number;
  isDragging: boolean;
}

/**
 * 서버 순서를 받아 `ReorderableList`/`NestedReorderableList`에 그대로 펼칠 props를 만든다.
 * 평소에는 받은 목록을 그대로 그린다. 끄는 동안과 놓은 뒤 서버 값이 새로 올 때까지만 화면 순서를 붙잡는다.
 */
export function useReorderableList<TItem, TId>({
  items,
  updatedAt,
  isPending,
  getItemId,
  onReorder,
}: UseReorderableListParams<TItem, TId>) {
  const haptics = useHaptics();
  const [hold, setHold] = useState<ReorderHold<TItem> | null>(null);
  const isHolding = hold != null && (hold.isDragging || isPending || hold.updatedAt === updatedAt);
  const data = isHolding ? hold.items : items;

  const handleDragStart = () => {
    setHold({ items: data, updatedAt, isDragging: true });
    haptics.impact('medium');
  };

  const handleDragEnd = ({ from, to }: ReorderableListDragEndEvent) => {
    if (from === to) {
      setHold(null);
    }
  };

  const handleIndexChange = () => {
    haptics.selection();
  };

  const handleReorder = ({ from, to }: ReorderableListReorderEvent) => {
    const reorderedItems = reorderItems(data, from, to);
    const instruction = getReorderInstruction(reorderedItems, from, to, getItemId);
    if (instruction == null) {
      setHold(null);
      return;
    }

    setHold({ items: reorderedItems, updatedAt, isDragging: false });
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
      scheduleOnRN(handleIndexChange);
    },
    onDragEnd: (event: ReorderableListDragEndEvent) => {
      'worklet';
      scheduleOnRN(handleDragEnd, event);
    },
  };
}
