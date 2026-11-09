import { useHaptics } from '@src/shared/di/shared-di-context';
import { useState } from 'react';
import {
  type ReorderableListDragEndEvent,
  type ReorderableListReorderEvent,
  reorderItems,
} from 'react-native-reorderable-list';
import { scheduleOnRN } from 'react-native-worklets';

import { getReorderInstruction, type ReorderInstruction } from '../utils/get-reorder-instruction';

/** 바로 켜면 Android에서 행 위 스와이프를 끌기가 가져가 스크롤이 멈춘다. `panGesture`는 gesture-handler 2 타입이라 3과 맞지 않아 `panActivateAfterLongPress`를 쓴다 */
const DRAG_ACTIVATION_DELAY_MS = 520;

interface ReorderedList<TItem, TId> {
  instruction: ReorderInstruction<TId>;
  items: TItem[];
}

interface UseReorderableListOptions<TItem, TId> {
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

/** 콜백이 worklet이라 햅틱을 호출부로 나누면 `scheduleOnRN`까지 옮겨야 해 여기서 낸다 */
export function useReorderableList<TItem, TId>({
  items,
  updatedAt,
  isPending,
  getItemId,
  onReorder,
}: UseReorderableListOptions<TItem, TId>) {
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
    const instruction = getReorderInstruction({ reorderedItems, from, to, getItemId });
    if (instruction == null) {
      setHold(null);
      return;
    }

    setHold({ items: reorderedItems, updatedAt, isDragging: false });
    onReorder({ instruction, items: reorderedItems });
  };

  return {
    data,
    panActivateAfterLongPress: DRAG_ACTIVATION_DELAY_MS,
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
